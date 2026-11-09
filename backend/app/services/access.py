"""صلاحيات تعديل المحتوى.

- المالك والمدير: يعدّلوا أي كورس.
- المعلم: يعدّل بس الكورسات المعيّنة عليه (اللي أنشأها بنفسه بتتعيّن عليه تلقائياً).
- لو المعلم حاول يوصل لكورس مش بتاعه، بنرجّع "غير موجود" (من غير ما نكشف إنه موجود).
"""
from fastapi import HTTPException
from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.models.teaching import teacher_course
from app.models.user import Role, User

FULL_ACCESS = (Role.super_admin, Role.admin)


def assigned_course_ids(teacher_id: int):
    """استعلام فرعي بأرقام كورسات المعلم (للاستخدام مع in_)."""
    return select(teacher_course.c.course_id).where(teacher_course.c.teacher_id == teacher_id)


def can_edit_course(db: Session, user: User, course_id: int) -> bool:
    if user.role in FULL_ACCESS:
        return True
    if user.role != Role.teacher:
        return False
    return db.execute(
        select(teacher_course.c.course_id).where(
            teacher_course.c.teacher_id == user.id, teacher_course.c.course_id == course_id
        )
    ).first() is not None


def ensure_course_access(db: Session, user: User, course_id: int, message: str = "الكورس غير موجود") -> None:
    if not can_edit_course(db, user, course_id):
        raise HTTPException(404, message)


def assign_teacher(db: Session, user: User, course_id: int) -> None:
    """المعلم اللي أنشأ كورس بيتعيّن عليه تلقائياً. غير كده مفيش حاجة بتحصل."""
    if user.role != Role.teacher:
        return
    already = db.execute(
        select(teacher_course.c.course_id).where(
            teacher_course.c.teacher_id == user.id, teacher_course.c.course_id == course_id
        )
    ).first()
    if not already:
        db.execute(insert(teacher_course).values(teacher_id=user.id, course_id=course_id))
        db.commit()
