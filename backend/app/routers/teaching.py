"""تعيين الكورسات على المعلمين (من صلاحيات المالك والمدير)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.academic import Course
from app.models.teaching import teacher_course
from app.models.user import Role, User
from app.schemas.teaching import AssignedCourses
from app.services import audit

router = APIRouter(prefix="/teachers", tags=["teaching"])
staff = require_roles(Role.super_admin, Role.admin)


def _teacher(db: Session, teacher_id: int) -> User:
    user = db.get(User, teacher_id)
    if user is None or user.role != Role.teacher:
        raise HTTPException(404, "المعلم غير موجود.")
    return user


@router.get("/{teacher_id}/courses", response_model=list[int])
def assigned_courses(teacher_id: int, db: Session = Depends(get_db), _: User = Depends(staff)):
    teacher = _teacher(db, teacher_id)
    return list(db.scalars(
        select(teacher_course.c.course_id).where(teacher_course.c.teacher_id == teacher.id)
    ).all())


@router.put("/{teacher_id}/courses", response_model=list[int])
def set_assigned_courses(teacher_id: int, data: AssignedCourses, request: Request,
                         db: Session = Depends(get_db), actor: User = Depends(staff)):
    """يستبدل قايمة كورسات المعلم بالقايمة المبعوتة."""
    teacher = _teacher(db, teacher_id)
    ids = sorted(set(data.course_ids))

    if ids:
        found = set(db.scalars(
            select(Course.id).where(Course.id.in_(ids), Course.is_active.is_(True))
        ).all())
        if found != set(ids):
            raise HTTPException(404, "أحد الكورسات غير موجود.")

    db.execute(delete(teacher_course).where(teacher_course.c.teacher_id == teacher.id))
    if ids:
        db.execute(insert(teacher_course), [{"teacher_id": teacher.id, "course_id": i} for i in ids])
    audit.log_action(db, actor_id=actor.id, action=audit.TEACHER_ASSIGNED, target_type="user",
                     target_id=teacher.id, detail=f"courses={len(ids)}", ip=client_ip(request))
    db.commit()
    return ids
