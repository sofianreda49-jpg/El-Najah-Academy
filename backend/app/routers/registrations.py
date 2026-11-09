"""طلبات التسجيل: المالك والمدير بيراجعوا ويوافقوا أو يرفضوا.

- المالك: يعتمد أي دور (طالب / ولي أمر / معلم).
- المدير: يعتمد الطلاب وأولياء الأمور بس. المعلمين من صلاحيات المالك فقط.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.academic import Grade
from app.models.user import Role, User
from app.schemas.registration import ApproveIn, RegistrationOut, RegistrationPage, RejectIn
from app.services import audit
from app.services.users import set_student_grade

router = APIRouter(prefix="/registrations", tags=["registrations"])
staff = require_roles(Role.super_admin, Role.admin)

REQUESTABLE = (Role.student, Role.parent, Role.teacher)
OWNER_ONLY_MESSAGE = "اعتماد المعلمين من صلاحيات المالك فقط."


def _out(u: User) -> RegistrationOut:
    return RegistrationOut(
        id=u.id, full_name=u.full_name, email=u.email, role=u.role, grade_id=u.grade_id,
        note=u.registration_note, approval_status=u.approval_status,
        rejection_reason=u.rejection_reason, created_at=u.created_at,
    )


def _request_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.approval_status == "approved" or user.role not in REQUESTABLE:
        raise HTTPException(404, "طلب التسجيل غير موجود.")
    return user


@router.get("", response_model=RegistrationPage)
def list_requests(
    status: Literal["pending", "rejected"] = "pending",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(staff),
):
    stmt = select(User).where(User.approval_status == status, User.role.in_(REQUESTABLE))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit)).all()
    return RegistrationPage(items=[_out(u) for u in items], total=total, page=page, limit=limit)


@router.post("/{user_id}/approve", response_model=RegistrationOut)
def approve(user_id: int, data: ApproveIn, request: Request,
            db: Session = Depends(get_db), actor: User = Depends(staff)):
    user = _request_or_404(db, user_id)
    final_role = Role(data.role) if data.role else user.role

    # المعلم (سواء مطلوب أو هيتحوّل له) قراره للمالك بس
    if Role.teacher in (user.role, final_role) and actor.role != Role.super_admin:
        raise HTTPException(403, OWNER_ONLY_MESSAGE)

    if final_role == Role.student and user.grade_id is None:
        grade = db.get(Grade, data.grade_id) if data.grade_id else None
        if grade is None or not grade.is_active:
            raise HTTPException(422, "اختر الصف الدراسي للطالب قبل القبول.")
        set_student_grade(db, user, grade.id)

    user.role = final_role
    user.approval_status = "approved"
    user.rejection_reason = None
    audit.log_action(db, actor_id=actor.id, action=audit.REGISTRATION_APPROVED, target_type="user",
                     target_id=user.id, detail=f"role={final_role.value}", ip=client_ip(request))
    db.commit()
    db.refresh(user)
    return _out(user)


@router.post("/{user_id}/reject", response_model=RegistrationOut)
def reject(user_id: int, data: RejectIn, request: Request,
           db: Session = Depends(get_db), actor: User = Depends(staff)):
    user = _request_or_404(db, user_id)
    if user.role == Role.teacher and actor.role != Role.super_admin:
        raise HTTPException(403, OWNER_ONLY_MESSAGE)

    user.approval_status = "rejected"
    user.rejection_reason = data.reason
    audit.log_action(db, actor_id=actor.id, action=audit.REGISTRATION_REJECTED, target_type="user",
                     target_id=user.id, ip=client_ip(request))
    db.commit()
    db.refresh(user)
    return _out(user)
