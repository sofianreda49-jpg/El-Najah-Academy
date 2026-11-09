"""لوحة ولي الأمر: ملخص لكل ابن مربوط بحسابه + آخر النتايج (قراءة فقط)."""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt
from app.models.progress import LessonProgress
from app.models.user import Role, User
from app.routers.parent import _linked_students, _overview

router = APIRouter(prefix="/parent", tags=["parent-dashboard"])
parent_only = require_roles(Role.parent)


class LastResult(BaseModel):
    assessment_title: str
    percentage: float
    is_passed: bool
    submitted_at: datetime | None


class ChildCard(BaseModel):
    id: int
    full_name: str
    grade_name: str | None
    total_lessons: int
    completed_lessons: int
    attempts_count: int
    average_percentage: float | None
    last_result: LastResult | None
    last_activity: datetime | None


class FeedItem(BaseModel):
    attempt_id: int
    child_id: int
    child_name: str
    assessment_title: str
    course_name: str
    percentage: float
    is_passed: bool
    submitted_at: datetime | None


class ParentDashboard(BaseModel):
    children: list[ChildCard]
    recent_results: list[FeedItem]


@router.get("/dashboard", response_model=ParentDashboard)
def dashboard(db: Session = Depends(get_db), parent: User = Depends(parent_only)):
    students = _linked_students(db, parent)
    cards: list[ChildCard] = []

    for s in students:
        overview = _overview(db, s)
        attempts, avg = db.execute(
            select(func.count(AssessmentAttempt.id), func.avg(AssessmentAttempt.percentage))
            .where(AssessmentAttempt.student_id == s.id, AssessmentAttempt.status != IN_PROGRESS)
        ).one()
        last = db.execute(
            select(AssessmentAttempt, Assessment.title)
            .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
            .where(AssessmentAttempt.student_id == s.id, AssessmentAttempt.status != IN_PROGRESS)
            .order_by(AssessmentAttempt.id.desc())
            .limit(1)
        ).first()
        last_activity = db.scalar(
            select(func.max(LessonProgress.completed_at)).where(LessonProgress.student_id == s.id)
        )
        cards.append(ChildCard(
            id=s.id, full_name=s.full_name,
            grade_name=overview.grade.name if overview.grade else None,
            total_lessons=overview.total_lessons, completed_lessons=overview.completed_lessons,
            attempts_count=attempts or 0,
            average_percentage=round(float(avg), 1) if avg is not None else None,
            last_result=LastResult(
                assessment_title=last[1], percentage=last[0].percentage, is_passed=last[0].is_passed,
                submitted_at=last[0].submitted_at,
            ) if last else None,
            last_activity=last_activity,
        ))

    feed: list[FeedItem] = []
    if students:
        names = {s.id: s.full_name for s in students}
        rows = db.execute(
            select(AssessmentAttempt, Assessment.title, Course.name)
            .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
            .join(Course, Course.id == Assessment.course_id)
            .where(AssessmentAttempt.student_id.in_(list(names)), AssessmentAttempt.status != IN_PROGRESS)
            .order_by(AssessmentAttempt.id.desc())
            .limit(8)
        ).all()
        feed = [
            FeedItem(
                attempt_id=at.id, child_id=at.student_id, child_name=names[at.student_id],
                assessment_title=title, course_name=cname, percentage=at.percentage,
                is_passed=at.is_passed, submitted_at=at.submitted_at,
            )
            for at, title, cname in rows
        ]

    return ParentDashboard(children=cards, recent_results=feed)
