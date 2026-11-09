"""إدارة الاختبارات والأسئلة ونتائج الطلاب.

المالك والمدير: كل الاختبارات. المعلم: اختبارات كورساته هو بس."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, cast, delete, func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course, Lesson, Unit
from app.models.assessment import (
    IN_PROGRESS, Assessment, AssessmentAttempt, Question, QuestionChoice,
)
from app.models.user import Role, User
from app.schemas.academy import MessageOut
from app.schemas.assessment import (
    AssessmentCreate, AssessmentDetail, AssessmentListItem, AssessmentUpdate, AttemptPage,
    AttemptRow, ChoiceStaffOut, QuestionIn, QuestionStaffOut, ResultsSummary,
)
from app.services import academy as svc
from app.services import audit
from app.services import access
from app.services import assessments as logic

router = APIRouter(prefix="/assessments", tags=["assessments"])
editor = require_roles(Role.super_admin, Role.admin, Role.teacher)


# ---------------------------------------------------------- helpers
def _get(db: Session, assessment_id: int) -> Assessment:
    return svc.get_active(db, Assessment, assessment_id, "الاختبار غير موجود")


def _check_lesson(db: Session, lesson_id: int | None, course_id: int) -> None:
    if lesson_id is None:
        return
    lesson = svc.get_active(db, Lesson, lesson_id, "الدرس غير موجود")
    unit = db.get(Unit, lesson.unit_id)
    if unit is None or unit.course_id != course_id:
        raise HTTPException(422, "هذا الدرس لا يتبع نفس الكورس.")


def _question_count(db: Session, assessment_id: int) -> int:
    return db.scalar(select(func.count(Question.id)).where(Question.assessment_id == assessment_id)) or 0


def _list_item(db: Session, a: Assessment) -> AssessmentListItem:
    return AssessmentListItem(
        id=a.id, course_id=a.course_id, lesson_id=a.lesson_id, title=a.title, kind=a.kind,
        is_published=a.is_published, time_limit_minutes=a.time_limit_minutes,
        passing_score=a.passing_score, max_attempts=a.max_attempts,
        question_count=_question_count(db, a.id), attempts_count=logic.attempts_count(db, a.id),
    )


def _question_out(q: Question, choices: list[QuestionChoice]) -> QuestionStaffOut:
    return QuestionStaffOut(
        id=q.id, kind=q.kind, text=q.text, explanation=q.explanation, points=q.points,
        order_index=q.order_index,
        choices=[ChoiceStaffOut.model_validate(c) for c in choices],
    )


def _detail(db: Session, a: Assessment) -> AssessmentDetail:
    questions, by_question = logic.questions_with_choices(db, a.id)
    base = _list_item(db, a).model_dump()
    return AssessmentDetail(
        **base,
        description=a.description, show_answers=a.show_answers,
        shuffle_questions=a.shuffle_questions, shuffle_choices=a.shuffle_choices,
        is_locked=base["attempts_count"] > 0,
        questions=[_question_out(q, by_question[q.id]) for q in questions],
    )


def _log(db: Session, actor: User, action: str, entity: str, obj_id: int, detail: str | None) -> None:
    audit.log_action(db, actor_id=actor.id, action=action, target_type=entity,
                     target_id=obj_id, detail=detail)


# ---------------------------------------------------------- الاختبارات
@router.get("", response_model=list[AssessmentListItem])
def list_assessments(course_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    access.ensure_course_access(db, actor, course_id)
    rows = db.scalars(
        select(Assessment).where(Assessment.course_id == course_id, Assessment.is_active.is_(True))
        .order_by(Assessment.id)
    ).all()
    return [_list_item(db, a) for a in rows]


@router.post("", response_model=AssessmentDetail, status_code=201)
def create_assessment(data: AssessmentCreate, db: Session = Depends(get_db), actor: User = Depends(editor)):
    access.ensure_course_access(db, actor, data.course_id)
    svc.ensure_active(db, Course, data.course_id, "الكورس غير موجود")
    _check_lesson(db, data.lesson_id, data.course_id)
    a = Assessment(**data.model_dump())
    db.add(a)
    db.flush()
    _log(db, actor, audit.ACADEMY_CREATED, "assessment", a.id, a.title)
    db.commit()
    db.refresh(a)
    return _detail(db, a)


@router.get("/{assessment_id}", response_model=AssessmentDetail)
def get_assessment(assessment_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    a = _get(db, assessment_id)
    access.ensure_course_access(db, actor, a.course_id, "الاختبار غير موجود")
    return _detail(db, a)


@router.patch("/{assessment_id}", response_model=AssessmentDetail)
def update_assessment(assessment_id: int, data: AssessmentUpdate, db: Session = Depends(get_db),
                      actor: User = Depends(editor)):
    a = _get(db, assessment_id)
    access.ensure_course_access(db, actor, a.course_id, "الاختبار غير موجود")
    payload = data.model_dump(exclude_unset=True)

    for key in ("title", "kind", "passing_score", "max_attempts", "show_answers",
                "shuffle_questions", "shuffle_choices", "is_published"):
        if key in payload and payload[key] is None:
            raise HTTPException(422, "قيمة غير مسموحة لهذا الحقل.")

    if "lesson_id" in payload:
        _check_lesson(db, payload["lesson_id"], a.course_id)
    if payload.get("is_published") and _question_count(db, a.id) == 0:
        raise HTTPException(409, "أضف سؤالاً واحداً على الأقل قبل نشر الاختبار.")

    for key, value in payload.items():
        setattr(a, key, value)
    if payload:
        _log(db, actor, audit.ACADEMY_UPDATED, "assessment", a.id, a.title)
    db.commit()
    db.refresh(a)
    return _detail(db, a)


@router.delete("/{assessment_id}", response_model=MessageOut)
def archive_assessment(assessment_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    """أرشفة: الاختبار بيختفي من الطلاب، ونتايجهم السابقة بتفضل محفوظة."""
    a = _get(db, assessment_id)
    access.ensure_course_access(db, actor, a.course_id, "الاختبار غير موجود")
    a.is_active = False
    a.is_published = False
    _log(db, actor, audit.ACADEMY_ARCHIVED, "assessment", a.id, a.title)
    db.commit()
    return {"message": "تم حذف الاختبار"}


# ---------------------------------------------------------- الأسئلة
def _write_choices(db: Session, question: Question, choices) -> None:
    for index, c in enumerate(choices, start=1):
        db.add(QuestionChoice(question_id=question.id, text=c.text, is_correct=c.is_correct,
                              order_index=index))


@router.post("/{assessment_id}/questions", response_model=QuestionStaffOut, status_code=201)
def create_question(assessment_id: int, data: QuestionIn, db: Session = Depends(get_db),
                    actor: User = Depends(editor)):
    a = _get(db, assessment_id)
    access.ensure_course_access(db, actor, a.course_id, "الاختبار غير موجود")
    logic.ensure_unlocked(db, a.id)
    logic.validate_choices(data.kind, data.choices)

    q = Question(assessment_id=a.id, kind=data.kind, text=data.text, explanation=data.explanation,
                 points=data.points, order_index=data.order_index)
    db.add(q)
    db.flush()
    _write_choices(db, q, data.choices)
    _log(db, actor, audit.ACADEMY_CREATED, "question", q.id, f"assessment={a.id}")
    db.commit()
    _, by_question = logic.questions_with_choices(db, a.id)
    return _question_out(q, by_question[q.id])


def _get_question(db: Session, question_id: int) -> tuple[Question, Assessment]:
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(404, "السؤال غير موجود")
    return q, _get(db, q.assessment_id)


@router.put("/questions/{question_id}", response_model=QuestionStaffOut)
def update_question(question_id: int, data: QuestionIn, db: Session = Depends(get_db),
                    actor: User = Depends(editor)):
    q, a = _get_question(db, question_id)
    access.ensure_course_access(db, actor, a.course_id, "السؤال غير موجود")
    logic.ensure_unlocked(db, a.id)
    logic.validate_choices(data.kind, data.choices)

    q.kind, q.text, q.explanation = data.kind, data.text, data.explanation
    q.points, q.order_index = data.points, data.order_index
    db.execute(delete(QuestionChoice).where(QuestionChoice.question_id == q.id))
    _write_choices(db, q, data.choices)
    _log(db, actor, audit.ACADEMY_UPDATED, "question", q.id, f"assessment={a.id}")
    db.commit()
    _, by_question = logic.questions_with_choices(db, a.id)
    return _question_out(q, by_question[q.id])


@router.delete("/questions/{question_id}", response_model=MessageOut)
def delete_question(question_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    q, a = _get_question(db, question_id)
    access.ensure_course_access(db, actor, a.course_id, "السؤال غير موجود")
    logic.ensure_unlocked(db, a.id)
    if a.is_published and _question_count(db, a.id) <= 1:
        raise HTTPException(409, "لا يمكن حذف آخر سؤال في اختبار منشور. ألغِ نشره أولاً.")

    db.execute(delete(QuestionChoice).where(QuestionChoice.question_id == q.id))
    _log(db, actor, audit.ACADEMY_ARCHIVED, "question", q.id, f"assessment={a.id}")
    db.delete(q)
    db.commit()
    return {"message": "تم حذف السؤال"}


# ---------------------------------------------------------- النتائج
@router.get("/{assessment_id}/attempts", response_model=AttemptPage)
def assessment_results(
    assessment_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(editor),
):
    a = _get(db, assessment_id)
    access.ensure_course_access(db, actor, a.course_id, "الاختبار غير موجود")
    base = (
        select(AssessmentAttempt)
        .where(AssessmentAttempt.assessment_id == a.id, AssessmentAttempt.status != IN_PROGRESS)
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = db.execute(
        select(AssessmentAttempt, User.full_name)
        .join(User, User.id == AssessmentAttempt.student_id)
        .where(AssessmentAttempt.assessment_id == a.id, AssessmentAttempt.status != IN_PROGRESS)
        .order_by(AssessmentAttempt.id.desc())
        .offset((page - 1) * limit).limit(limit)
    ).all()

    agg = db.execute(
        select(
            func.count(AssessmentAttempt.id),
            func.count(func.distinct(AssessmentAttempt.student_id)),
            func.coalesce(func.avg(AssessmentAttempt.percentage), 0),
            func.coalesce(func.sum(cast(AssessmentAttempt.is_passed, Integer)), 0),
        ).where(AssessmentAttempt.assessment_id == a.id, AssessmentAttempt.status != IN_PROGRESS)
    ).one()
    attempts, students, avg, passed = agg
    summary = ResultsSummary(
        attempts=attempts, students=students,
        average_percentage=round(float(avg), 1),
        pass_rate=round(passed * 100 / attempts, 1) if attempts else 0,
    )

    items = [
        AttemptRow(
            id=at.id, student_id=at.student_id, student_name=name, attempt_number=at.attempt_number,
            status=at.status, score=at.score, max_score=at.max_score, percentage=at.percentage,
            is_passed=at.is_passed, submitted_at=at.submitted_at,
        )
        for at, name in rows
    ]
    return AttemptPage(items=items, total=total, page=page, limit=limit, summary=summary)

