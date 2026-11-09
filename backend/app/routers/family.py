"""ربط ولي الأمر بأبنائه (من صلاحيات المالك والمدير)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.family import parent_student
from app.models.user import Role, User
from app.schemas.academy import MessageOut
from app.schemas.family import ChildRef
from app.services import audit

router = APIRouter(prefix="/parents", tags=["family"])
staff = require_roles(Role.super_admin, Role.admin)


def _parent(db: Session, parent_id: int) -> User:
    user = db.get(User, parent_id)
    if user is None or user.role != Role.parent:
        raise HTTPException(404, "ولي الأمر غير موجود.")
    return user


def _student(db: Session, student_id: int) -> User:
    user = db.get(User, student_id)
    if user is None or user.role != Role.student:
        raise HTTPException(404, "الطالب غير موجود.")
    return user


def _ref(u: User) -> ChildRef:
    return ChildRef(id=u.id, full_name=u.full_name, email=u.email, grade_id=u.grade_id)


@router.get("/{parent_id}/children", response_model=list[ChildRef])
def list_children(parent_id: int, db: Session = Depends(get_db), _: User = Depends(staff)):
    parent = _parent(db, parent_id)
    students = db.scalars(
        select(User)
        .join(parent_student, parent_student.c.student_id == User.id)
        .where(parent_student.c.parent_id == parent.id)
        .order_by(User.full_name)
    ).all()
    return [_ref(s) for s in students]


@router.post("/{parent_id}/children/{student_id}", response_model=ChildRef, status_code=201)
def link_child(parent_id: int, student_id: int, request: Request,
               db: Session = Depends(get_db), actor: User = Depends(staff)):
    parent = _parent(db, parent_id)
    student = _student(db, student_id)

    exists = db.execute(
        select(parent_student.c.parent_id).where(
            parent_student.c.parent_id == parent.id, parent_student.c.student_id == student.id
        )
    ).first()
    if exists:
        raise HTTPException(409, "هذا الطالب مربوط بولي الأمر بالفعل.")

    db.execute(insert(parent_student).values(parent_id=parent.id, student_id=student.id))
    audit.log_action(db, actor_id=actor.id, action=audit.PARENT_LINKED, target_type="user",
                     target_id=parent.id, detail=f"student={student.id}", ip=client_ip(request))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "تعذر الربط. حاول مرة أخرى.")
    return _ref(student)


@router.delete("/{parent_id}/children/{student_id}", response_model=MessageOut)
def unlink_child(parent_id: int, student_id: int, request: Request,
                 db: Session = Depends(get_db), actor: User = Depends(staff)):
    parent = _parent(db, parent_id)
    result = db.execute(
        delete(parent_student).where(
            parent_student.c.parent_id == parent.id, parent_student.c.student_id == student_id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(404, "هذا الطالب غير مربوط بولي الأمر.")
    audit.log_action(db, actor_id=actor.id, action=audit.PARENT_UNLINKED, target_type="user",
                     target_id=parent.id, detail=f"student={student_id}", ip=client_ip(request))
    db.commit()
    return {"message": "تم فك الربط"}
