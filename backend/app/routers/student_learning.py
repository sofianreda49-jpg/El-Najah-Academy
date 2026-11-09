"""شاشة التعلّم: الدرس + شجرة الكورس في طلب واحد (بدل طلبين منفصلين)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import Role, User
from app.routers.student import course_view, lesson_view
from app.schemas.student import CourseView, LessonView

router = APIRouter(prefix="/student", tags=["student-learning"])
student_only = require_roles(Role.student)


class PlayerView(BaseModel):
    lesson: LessonView
    course: CourseView


@router.get("/lessons/{lesson_id}/player", response_model=PlayerView)
def player(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    """نفس قواعد الوصول بالظبط: الدرس لازم يكون منشور ومن كورس متاح للطالب."""
    lesson = lesson_view(lesson_id=lesson_id, db=db, user=user)
    course = course_view(course_id=lesson.course.id, db=db, user=user)
    return PlayerView(lesson=lesson, course=course)
