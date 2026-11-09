"""لوحة الطالب: كل الأرقام من بيانات حقيقية (تقدم الدروس، المحاولات، النتايج).

مفيش بيانات وهمية: لو مفيش حاجة تتعرض، القايمة بترجع فاضية والواجهة بتعرض حالة فاضية.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Integer, and_, cast, func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course, Lesson, Unit
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt, Question
from app.models.progress import LessonProgress
from app.models.user import Role, User
from app.routers.student import home as build_home
from app.routers.student_assessments import _item
from app.schemas.assessment import ResultRow
from app.schemas.student import CourseCard, GradeRef

router = APIRouter(prefix="/student", tags=["student-dashboard"])
student_only = require_roles(Role.student)


class ContinueItem(BaseModel):
    course_id: int
    course_name: str
    subject_name: str
    term_name: str
    lesson_id: int
    lesson_title: str
    completed_lessons: int
    total_lessons: int
    started: bool


class RecentLesson(BaseModel):
    lesson_id: int
    lesson_title: str
    course_id: int
    course_name: str
    completed_at: datetime


class AssessmentTodo(BaseModel):
    id: int
    title: str
    course_id: int
    course_name: str
    kind: str
    question_count: int
    time_limit_minutes: int | None
    attempts_used: int
    max_attempts: int
    has_open_attempt: bool


class DashboardStats(BaseModel):
    attempts_count: int
    average_percentage: float | None
    passed_count: int


class DashboardOut(BaseModel):
    grade: GradeRef | None
    year: str | None
    courses: list[CourseCard]
    total_lessons: int
    completed_lessons: int
    continue_items: list[ContinueItem]
    recent_lessons: list[RecentLesson]
    assessments_todo: list[AssessmentTodo]
    recent_results: list[ResultRow]
    stats: DashboardStats


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(student_only)):
    overview = build_home(db=db, user=user)  # الصف، السنة، الكورسات المتاحة وتقدم كل واحد
    course_ids = [c.id for c in overview.courses]
    course_names = {c.id: c.name for c in overview.courses}

    # ---------- تابع من حيث توقفت ----------
    continue_items: list[ContinueItem] = []
    if course_ids:
        last_activity = dict(db.execute(
            select(Unit.course_id, func.max(LessonProgress.completed_at))
            .select_from(LessonProgress)
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .join(Unit, Unit.id == Lesson.unit_id)
            .where(LessonProgress.student_id == user.id, Unit.course_id.in_(course_ids))
            .group_by(Unit.course_id)
        ).all())

        # أول درس لسه ما اتكملش في كل كورس: استعلام واحد لكل الكورسات (بنفس ترتيب الوحدات والدروس)
        lesson_rows = db.execute(
            select(Unit.course_id, Lesson.id, Lesson.title, LessonProgress.lesson_id)
            .select_from(Lesson)
            .join(Unit, Unit.id == Lesson.unit_id)
            .outerjoin(
                LessonProgress,
                and_(LessonProgress.lesson_id == Lesson.id, LessonProgress.student_id == user.id),
            )
            .where(Unit.course_id.in_(course_ids), Unit.is_active.is_(True),
                   Lesson.is_active.is_(True), Lesson.is_published.is_(True))
            .order_by(Unit.course_id, Unit.order_index, Unit.id, Lesson.order_index, Lesson.id)
        ).all()
        next_lesson: dict[int, tuple[int, str]] = {}
        for cid, lesson_id, lesson_title, done_marker in lesson_rows:
            if done_marker is None and cid not in next_lesson:
                next_lesson[cid] = (lesson_id, lesson_title)

        candidates = []
        for card in overview.courses:
            nxt = next_lesson.get(card.id)
            if nxt and card.total_lessons and card.completed_lessons < card.total_lessons:
                candidates.append((last_activity.get(card.id), card, nxt))

        # اللي بدأت فيهم الأول (الأحدث نشاطاً)، وبعدين اللي لسه ما بدأتش
        candidates.sort(key=lambda x: (x[0] is None, -(x[0].timestamp() if x[0] else 0)))
        for last, card, (lesson_id, lesson_title) in candidates[:3]:
            continue_items.append(ContinueItem(
                course_id=card.id, course_name=card.name, subject_name=card.subject_name,
                term_name=card.term_name, lesson_id=lesson_id, lesson_title=lesson_title,
                completed_lessons=card.completed_lessons, total_lessons=card.total_lessons,
                started=last is not None,
            ))

    # ---------- دروس أنهيتها مؤخراً ----------
    recent_rows = db.execute(
        select(LessonProgress.completed_at, Lesson.id, Lesson.title, Course.id, Course.name)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Unit, Unit.id == Lesson.unit_id)
        .join(Course, Course.id == Unit.course_id)
        .where(
            LessonProgress.student_id == user.id, Lesson.is_active.is_(True), Lesson.is_published.is_(True),
            Unit.is_active.is_(True), Course.is_active.is_(True), Course.is_published.is_(True),
        )
        .order_by(LessonProgress.completed_at.desc())
        .limit(5)
    ).all()
    recent_lessons = [
        RecentLesson(lesson_id=lid, lesson_title=title, course_id=cid, course_name=cname, completed_at=at)
        for at, lid, title, cid, cname in recent_rows
    ]

    # ---------- اختبارات متاحة ليك (لسه ما نجحتش فيها وعندك محاولات) ----------
    todo: list[AssessmentTodo] = []
    if course_ids:
        assessments = db.scalars(
            select(Assessment)
            .where(Assessment.course_id.in_(course_ids), Assessment.is_active.is_(True),
                   Assessment.is_published.is_(True))
            .order_by(Assessment.id.desc())
        ).all()
        if assessments:
            ids = [a.id for a in assessments]
            counts = dict(db.execute(
                select(Question.assessment_id, func.count(Question.id))
                .where(Question.assessment_id.in_(ids)).group_by(Question.assessment_id)
            ).all())
            attempts_by: dict[int, list[AssessmentAttempt]] = {i: [] for i in ids}
            for att in db.scalars(
                select(AssessmentAttempt)
                .where(AssessmentAttempt.student_id == user.id, AssessmentAttempt.assessment_id.in_(ids))
                .order_by(AssessmentAttempt.attempt_number)
            ).all():
                attempts_by[att.assessment_id].append(att)

            for a in assessments:
                if counts.get(a.id, 0) == 0:
                    continue
                item = _item(a, counts[a.id], attempts_by[a.id])
                if item.can_start and not item.passed:
                    todo.append(AssessmentTodo(
                        id=a.id, title=a.title, course_id=a.course_id,
                        course_name=course_names.get(a.course_id, ""), kind=a.kind.value,
                        question_count=item.question_count, time_limit_minutes=a.time_limit_minutes,
                        attempts_used=item.attempts_used, max_attempts=item.max_attempts,
                        has_open_attempt=item.open_attempt_id is not None,
                    ))
            todo.sort(key=lambda x: not x.has_open_attempt)  # المحاولات الجارية الأول
            todo = todo[:5]

    # ---------- آخر النتايج + إحصائيات ----------
    result_rows = db.execute(
        select(AssessmentAttempt, Assessment.title, Course.name)
        .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
        .join(Course, Course.id == Assessment.course_id)
        .where(AssessmentAttempt.student_id == user.id, AssessmentAttempt.status != IN_PROGRESS)
        .order_by(AssessmentAttempt.id.desc())
        .limit(5)
    ).all()
    recent_results = [
        ResultRow(
            attempt_id=at.id, assessment_id=at.assessment_id, assessment_title=title, course_name=cname,
            attempt_number=at.attempt_number, status=at.status, score=at.score, max_score=at.max_score,
            percentage=at.percentage, is_passed=at.is_passed, submitted_at=at.submitted_at,
        )
        for at, title, cname in result_rows
    ]

    attempts_count, avg, passed = db.execute(
        select(func.count(AssessmentAttempt.id), func.avg(AssessmentAttempt.percentage),
               func.sum(cast(AssessmentAttempt.is_passed, Integer)))
        .where(AssessmentAttempt.student_id == user.id, AssessmentAttempt.status != IN_PROGRESS)
    ).one()

    return DashboardOut(
        grade=overview.grade, year=overview.year, courses=overview.courses,
        total_lessons=overview.total_lessons, completed_lessons=overview.completed_lessons,
        continue_items=continue_items, recent_lessons=recent_lessons, assessments_todo=todo,
        recent_results=recent_results,
        stats=DashboardStats(
            attempts_count=attempts_count or 0,
            average_percentage=round(float(avg), 1) if avg is not None else None,
            passed_count=int(passed or 0),
        ),
    )
