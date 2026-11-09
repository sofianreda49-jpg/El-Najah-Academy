"""نظرة عامة للمعلم: ملخص كورساته وآخر التسليمات والطلاب اللي محتاجين متابعة."""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt
from app.models.user import Role, User
from app.routers.teacher import _published_lessons
from app.services import access, visibility

router = APIRouter(prefix="/teacher", tags=["teacher-overview"])
teacher_only = require_roles(Role.teacher)

LOW_SCORE = 60  # متوسط أقل من كده = محتاج متابعة


class TeacherSummary(BaseModel):
    courses: int
    students: int
    published_lessons: int
    assessments: int


class Submission(BaseModel):
    attempt_id: int
    student_name: str
    assessment_id: int
    assessment_title: str
    course_name: str
    percentage: float
    is_passed: bool
    submitted_at: datetime | None


class AttentionStudent(BaseModel):
    student_id: int
    student_name: str
    average_percentage: float
    attempts_count: int


class TeacherOverview(BaseModel):
    summary: TeacherSummary
    low_score_threshold: int
    recent_submissions: list[Submission]
    attention: list[AttentionStudent]


@router.get("/overview", response_model=TeacherOverview)
def overview(db: Session = Depends(get_db), teacher: User = Depends(teacher_only)):
    course_ids = list(db.scalars(
        select(Course.id).where(Course.id.in_(access.assigned_course_ids(teacher.id)), Course.is_active.is_(True))
    ).all())

    if not course_ids:
        return TeacherOverview(
            summary=TeacherSummary(courses=0, students=0, published_lessons=0, assessments=0),
            low_score_threshold=LOW_SCORE, recent_submissions=[], attention=[],
        )

    courses = db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    student_ids: set[int] = set()
    lessons = 0
    for course in courses:
        student_ids |= {s.id for s in visibility.students_of_course(db, course)}
        lessons += _published_lessons(db, course.id)

    assessments = db.scalar(
        select(func.count(Assessment.id)).where(Assessment.course_id.in_(course_ids), Assessment.is_active.is_(True))
    ) or 0

    submitted = (Assessment.course_id.in_(course_ids), AssessmentAttempt.status != IN_PROGRESS)

    rows = db.execute(
        select(AssessmentAttempt, User.full_name, Assessment.id, Assessment.title, Course.name)
        .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
        .join(Course, Course.id == Assessment.course_id)
        .join(User, User.id == AssessmentAttempt.student_id)
        .where(*submitted)
        .order_by(AssessmentAttempt.id.desc())
        .limit(8)
    ).all()
    recent = [
        Submission(
            attempt_id=at.id, student_name=name, assessment_id=aid, assessment_title=title, course_name=cname,
            percentage=at.percentage, is_passed=at.is_passed, submitted_at=at.submitted_at,
        )
        for at, name, aid, title, cname in rows
    ]

    avg_col = func.avg(AssessmentAttempt.percentage)
    low_rows = db.execute(
        select(AssessmentAttempt.student_id, User.full_name, avg_col, func.count(AssessmentAttempt.id))
        .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
        .join(User, User.id == AssessmentAttempt.student_id)
        .where(*submitted)
        .group_by(AssessmentAttempt.student_id, User.full_name)
        .having(avg_col < LOW_SCORE)
        .order_by(avg_col.asc())
        .limit(5)
    ).all()
    attention = [
        AttentionStudent(student_id=sid, student_name=name, average_percentage=round(float(avg), 1), attempts_count=cnt)
        for sid, name, avg, cnt in low_rows
    ]

    return TeacherOverview(
        summary=TeacherSummary(
            courses=len(course_ids), students=len(student_ids), published_lessons=lessons, assessments=assessments,
        ),
        low_score_threshold=LOW_SCORE, recent_submissions=recent, attention=attention,
    )
