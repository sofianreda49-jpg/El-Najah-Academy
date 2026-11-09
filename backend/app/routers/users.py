from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import ResetPasswordIn, UserCreate, UserOut, UserPage, UserUpdate
from app.services import audit
from app.services.users import can_manage, create_user, set_student_grade

router = APIRouter(prefix="/users", tags=["users"])

staff = require_roles(Role.super_admin, Role.admin)


def _escape_like(text_value: str) -> str:
    return text_value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=UserPage)
def list_users(
    role: Role | None = None,
    is_active: bool | None = None,
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: Literal["id", "full_name", "email", "role", "last_login_at"] = "id",
    order: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
    actor: User = Depends(staff),
):
    stmt = select(User).where(User.approval_status == "approved")  # الطلبات المعلقة في شاشتها
    if actor.role == Role.admin:
        stmt = stmt.where(User.role != Role.super_admin)  # المدير لا يرى حساب المالك
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if q and q.strip():
        like = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(User.full_name.ilike(like, escape="\\"), User.email.ilike(like.lower(), escape="\\"))
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    sort_column = {
        "id": User.id, "full_name": User.full_name, "email": User.email,
        "role": User.role, "last_login_at": User.last_login_at,
    }[sort]
    ordering = sort_column.asc() if order == "asc" else sort_column.desc()
    if sort == "last_login_at":
        ordering = ordering.nulls_last()  # اللي ما دخلش أبداً في الآخر
    items = db.scalars(
        stmt.order_by(ordering, User.id.desc()).offset((page - 1) * limit).limit(limit)
    ).all()
    return UserPage(items=items, total=total, page=page, limit=limit)


@router.post("", response_model=UserOut, status_code=201)
def create(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(staff),
):
    return create_user(
        db, actor,
        full_name=data.full_name, email=data.email, password=data.password,
        role=data.role, ip=client_ip(request), grade_id=data.grade_id,
    )


def _target(db: Session, actor: User, user_id: int) -> User:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "المستخدم غير موجود.")
    if not can_manage(actor, target):
        raise HTTPException(403, "لا يمكنك تعديل هذا الحساب.")
    return target


@router.patch("/{user_id}", response_model=UserOut)
def update(
    user_id: int,
    data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(staff),
):
    target = _target(db, actor, user_id)
    ip = client_ip(request)

    if data.full_name is not None and data.full_name != target.full_name:
        target.full_name = data.full_name
        audit.log_action(db, actor_id=actor.id, action=audit.USER_UPDATED,
                         target_type="user", target_id=target.id, ip=ip)

    if data.grade_id is not None:
        if target.role != Role.student:
            raise HTTPException(400, "الصف الدراسي خاص بحسابات الطلاب فقط.")
        if data.grade_id != target.grade_id:
            set_student_grade(db, target, data.grade_id)
            audit.log_action(db, actor_id=actor.id, action=audit.USER_UPDATED,
                             target_type="user", target_id=target.id,
                             detail=f"grade_id={data.grade_id}", ip=ip)

    if data.is_active is not None and data.is_active != target.is_active:
        target.is_active = data.is_active
        if not data.is_active:
            target.token_version += 1  # يطرد أي جلسة شغالة
        audit.log_action(
            db, actor_id=actor.id,
            action=audit.USER_ACTIVATED if data.is_active else audit.USER_DEACTIVATED,
            target_type="user", target_id=target.id, ip=ip,
        )

    db.commit()
    db.expire(target)
    return target


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: int,
    data: ResetPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(staff),
):
    target = _target(db, actor, user_id)
    target.password_hash = hash_password(data.new_password)
    target.must_change_password = True
    target.token_version += 1
    target.failed_login_count = 0
    target.locked_until = None
    audit.log_action(db, actor_id=actor.id, action=audit.PASSWORD_RESET,
                     target_type="user", target_id=target.id, ip=client_ip(request))
    db.commit()
    db.expire(target)
    return target
