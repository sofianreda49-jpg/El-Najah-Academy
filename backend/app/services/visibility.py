"""مين يشوف الكورس؟

- الكورس "grade": كل طلاب نفس الصف + أي طالب اتضاف عليه يدوياً.
- الكورس "enrolled": الطلاب اللي اتضافوا يدوياً بس.
"""
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.academic import Course
from app.models.enrollment import course_enrollment
from app.models.student import StudentProfile
from app.models.user import Role, User


def visible_course_clause(student_id: int, grade_id: int):
    """شرط SQL: الكورسات اللي الطالب يقدر يوصلها."""
    enrolled = select(course_enrollment.c.course_id).where(course_enrollment.c.student_id == student_id)
    return or_(and_(Course.access == "grade", Course.grade_id == grade_id), Course.id.in_(enrolled))


def student_can_access(db: Session, student_id: int, grade_id: int, course: Course) -> bool:
    if course.access == "grade" and course.grade_id == grade_id:
        return True
    return db.execute(
        select(course_enrollment.c.course_id).where(
            course_enrollment.c.course_id == course.id, course_enrollment.c.student_id == student_id
        )
    ).first() is not None


def students_of_course(db: Session, course: Course) -> list[User]:
    """كل الطلاب النشطين اللي يقدروا يشوفوا الكورس (للمعلم والتقارير)."""
    conditions = [
        User.id.in_(select(course_enrollment.c.student_id).where(course_enrollment.c.course_id == course.id))
    ]
    if course.access == "grade":
        conditions.append(
            User.id.in_(select(StudentProfile.student_id).where(StudentProfile.grade_id == course.grade_id))
        )
    return list(db.scalars(
        select(User)
        .where(User.role == Role.student, User.is_active.is_(True),
               User.approval_status == "approved", or_(*conditions))
        .order_by(User.full_name)
    ).all())
