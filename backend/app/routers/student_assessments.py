"""اختبارات الطالب: القايمة، البدء، الحل، التسليم والتصحيح، والنتائج.

الباك إند هو اللي بيحدد الوقت وبيصحح: الواجهة مش بتعرف الإجابة الصحيحة
إلا بعد التسليم (ولو الإدارة سمحت بإظهار الإجابات).
"""
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course
from app.models.assessment import (
    IN_PROGRESS, Assessment, AssessmentAttempt, AttemptAnswer, Question, QuestionType,
)
from app.models.mixins import utcnow
from app.models.user import Role, User
from app.routers.student import _accessible_course
from app.schemas.assessment import (
    AttemptDetail, AttemptSummary, ResultRow, ReviewChoice, ReviewQuestion, StudentAssessmentInfo,
    StudentAssessmentItem, SubmitIn, TakeChoice, TakeQuestion,
)
from app.services import assessments as logic

router = APIRouter(prefix="/student", tags=["student-assessments"])
student_only = require_roles(Role.student)


# ---------------------------------------------------------- helpers
def _visible_assessment(db: Session, user: User, assessment_id: int) -> Assessment:
    a = db.get(Assessment, assessment_id)
    if a is None or not a.is_active or not a.is_published:
        raise HTTPException(404, "الاختبار غير موجود.")
    _accessible_course(db, user, a.course_id)  # لازم الكورس يكون لصف الطالب ومنشور
    return a


def _attempts(db: Session, student_id: int, assessment_id: int) -> list[AssessmentAttempt]:
    return list(db.scalars(
        select(AssessmentAttempt)
        .where(AssessmentAttempt.student_id == student_id, AssessmentAttempt.assessment_id == assessment_id)
        .order_by(AssessmentAttempt.attempt_number)
    ).all())


def _finalize_expired(db: Session, attempts: list[AssessmentAttempt], a: Assessment) -> None:
    changed = False
    for att in attempts:
        if att.status == IN_PROGRESS and logic.is_expired(att):
            logic.grade_and_finalize(db, att, a, {}, status="expired")
            changed = True
    if changed:
        db.commit()


def _item(a: Assessment, question_count: int, attempts: list[AssessmentAttempt]) -> StudentAssessmentItem:
    open_att = next((x for x in attempts if x.status == IN_PROGRESS and not logic.is_expired(x)), None)
    finished = [x for x in attempts if x.status != IN_PROGRESS]
    return StudentAssessmentItem(
        id=a.id, title=a.title, kind=a.kind, question_count=question_count,
        time_limit_minutes=a.time_limit_minutes, passing_score=a.passing_score,
        max_attempts=a.max_attempts, attempts_used=len(attempts),
        best_percentage=max((x.percentage for x in finished), default=None),
        passed=any(x.is_passed for x in finished),
        can_start=open_att is not None or len(attempts) < a.max_attempts,
        open_attempt_id=open_att.id if open_att else None,
    )


def _own_attempt(db: Session, user: User, attempt_id: int, *, lock: bool = False) -> AssessmentAttempt:
    stmt = select(AssessmentAttempt).where(
        AssessmentAttempt.id == attempt_id, AssessmentAttempt.student_id == user.id
    )
    if lock:
        stmt = stmt.with_for_update()
    attempt = db.scalar(stmt)
    if attempt is None:
        raise HTTPException(404, "المحاولة غير موجودة.")
    return attempt


def _build_detail(db: Session, attempt: AssessmentAttempt, a: Assessment) -> AttemptDetail:
    base = dict(
        id=attempt.id, assessment_id=a.id, assessment_title=a.title, course_id=a.course_id,
        status=attempt.status, attempt_number=attempt.attempt_number, started_at=attempt.started_at,
        deadline_at=attempt.deadline_at, server_time=utcnow(), passing_score=a.passing_score,
    )
    questions, by_question = logic.questions_with_choices(db, a.id)

    if attempt.status == IN_PROGRESS:
        ordered = logic.shuffled(questions, attempt.shuffle_seed) if a.shuffle_questions else questions
        take = []
        for q in ordered:
            choices = by_question[q.id]
            if a.shuffle_choices and q.kind == QuestionType.mcq:
                choices = logic.shuffled(choices, attempt.shuffle_seed, q.id)
            take.append(TakeQuestion(
                id=q.id, kind=q.kind, text=q.text, points=q.points,
                choices=[TakeChoice(id=c.id, text=c.text) for c in choices],
            ))
        return AttemptDetail(**base, questions=take)

    used = db.scalar(select(func.count(AssessmentAttempt.id)).where(
        AssessmentAttempt.student_id == attempt.student_id, AssessmentAttempt.assessment_id == a.id
    )) or 0

    review = None
    if a.show_answers:
        rows = {
            r.question_id: r
            for r in db.scalars(select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt.id)).all()
        }
        review = []
        for q in questions:
            row = rows.get(q.id)
            selected_id = row.selected_choice_id if row else None
            review.append(ReviewQuestion(
                id=q.id, kind=q.kind, text=q.text, points=q.points,
                earned=row.points_earned if row else 0, answered=selected_id is not None,
                is_correct=bool(row and row.is_correct), explanation=q.explanation,
                choices=[
                    ReviewChoice(id=c.id, text=c.text, is_correct=c.is_correct, selected=c.id == selected_id)
                    for c in by_question[q.id]
                ],
            ))

    return AttemptDetail(
        **base, score=attempt.score, max_score=attempt.max_score, percentage=attempt.percentage,
        is_passed=attempt.is_passed,
        is_full_mark=attempt.max_score > 0 and attempt.score == attempt.max_score,
        submitted_at=attempt.submitted_at, can_retry=used < a.max_attempts, review=review,
    )


# ---------------------------------------------------------- القوايم
@router.get("/courses/{course_id}/assessments", response_model=list[StudentAssessmentItem])
def course_assessments(course_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    course = _accessible_course(db, user, course_id)
    assessments = db.scalars(
        select(Assessment)
        .where(Assessment.course_id == course.id, Assessment.is_active.is_(True),
               Assessment.is_published.is_(True))
        .order_by(Assessment.id)
    ).all()
    if not assessments:
        return []

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

    return [_item(a, counts.get(a.id, 0), attempts_by[a.id]) for a in assessments if counts.get(a.id, 0) > 0]


@router.get("/assessments/{assessment_id}", response_model=StudentAssessmentInfo)
def assessment_info(assessment_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    a = _visible_assessment(db, user, assessment_id)
    attempts = _attempts(db, user.id, a.id)
    _finalize_expired(db, attempts, a)
    attempts = _attempts(db, user.id, a.id)

    question_count = db.scalar(select(func.count(Question.id)).where(Question.assessment_id == a.id)) or 0
    item = _item(a, question_count, attempts).model_dump()
    return StudentAssessmentInfo(
        **item, description=a.description, course_id=a.course_id,
        attempts=[
            AttemptSummary(
                id=x.id, attempt_number=x.attempt_number, status=x.status, score=x.score,
                max_score=x.max_score, percentage=x.percentage, is_passed=x.is_passed,
                submitted_at=x.submitted_at,
            )
            for x in reversed(attempts) if x.status != IN_PROGRESS
        ],
    )


# ---------------------------------------------------------- البدء والحل
@router.post("/assessments/{assessment_id}/start", response_model=AttemptDetail)
def start_attempt(assessment_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    a = _visible_assessment(db, user, assessment_id)
    attempts = _attempts(db, user.id, a.id)
    _finalize_expired(db, attempts, a)
    attempts = _attempts(db, user.id, a.id)

    # فيه محاولة مفتوحة؟ نكمل منها (مش بنعمل محاولة جديدة)
    open_att = next((x for x in attempts if x.status == IN_PROGRESS), None)
    if open_att:
        return _build_detail(db, open_att, a)

    if len(attempts) >= a.max_attempts:
        raise HTTPException(409, "استنفدت عدد المحاولات المسموحة لهذا الاختبار.")
    has_questions = db.scalar(select(func.count(Question.id)).where(Question.assessment_id == a.id)) or 0
    if not has_questions:
        raise HTTPException(409, "هذا الاختبار لا يحتوي على أسئلة بعد.")

    now = utcnow()
    attempt = AssessmentAttempt(
        student_id=user.id, assessment_id=a.id, attempt_number=len(attempts) + 1,
        status=IN_PROGRESS, shuffle_seed=random.randrange(1, 2**30),
        started_at=now, deadline_at=logic.deadline_for(a, now),
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        # ضغطة مزدوجة: محاولة اتفتحت بالفعل، نرجّعها
        db.rollback()
        existing = next((x for x in _attempts(db, user.id, a.id) if x.status == IN_PROGRESS), None)
        if existing is None:
            raise HTTPException(409, "تعذر بدء الاختبار. حاول مرة أخرى.")
        return _build_detail(db, existing, a)
    db.refresh(attempt)
    return _build_detail(db, attempt, a)


@router.get("/attempts/{attempt_id}", response_model=AttemptDetail)
def get_attempt(attempt_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    attempt = _own_attempt(db, user, attempt_id)
    a = db.get(Assessment, attempt.assessment_id)
    if attempt.status == IN_PROGRESS:
        if logic.is_expired(attempt):
            logic.expire_attempt(db, attempt, a)
            db.refresh(attempt)
        elif not a.is_active or not a.is_published:
            raise HTTPException(409, "هذا الاختبار لم يعد متاحاً.")
    return _build_detail(db, attempt, a)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptDetail)
def submit_attempt(attempt_id: int, data: SubmitIn, db: Session = Depends(get_db),
                   user: User = Depends(student_only)):
    attempt = _own_attempt(db, user, attempt_id, lock=True)  # قفل: بيمنع التسليم المزدوج
    a = db.get(Assessment, attempt.assessment_id)

    if attempt.status != IN_PROGRESS:
        raise HTTPException(409, "تم تسليم هذه المحاولة بالفعل.")

    if logic.is_expired(attempt):
        logic.expire_attempt(db, attempt, a)
    else:
        answers = {x.question_id: x.choice_id for x in data.answers}
        logic.grade_and_finalize(db, attempt, a, answers)
        db.commit()
    db.refresh(attempt)
    return _build_detail(db, attempt, a)


# ---------------------------------------------------------- النتائج
@router.get("/results", response_model=list[ResultRow])
def my_results(db: Session = Depends(get_db), user: User = Depends(student_only)):
    rows = db.execute(
        select(AssessmentAttempt, Assessment.title, Course.name)
        .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
        .join(Course, Course.id == Assessment.course_id)
        .where(AssessmentAttempt.student_id == user.id, AssessmentAttempt.status != IN_PROGRESS)
        .order_by(AssessmentAttempt.id.desc())
        .limit(200)
    ).all()
    return [
        ResultRow(
            attempt_id=at.id, assessment_id=at.assessment_id, assessment_title=title,
            course_name=course_name, attempt_number=at.attempt_number, status=at.status,
            score=at.score, max_score=at.max_score, percentage=at.percentage,
            is_passed=at.is_passed, submitted_at=at.submitted_at,
        )
        for at, title, course_name in rows
    ]
