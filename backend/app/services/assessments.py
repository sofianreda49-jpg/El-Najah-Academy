"""منطق الاختبارات: التحقق من الأسئلة، القفل، الخلط، والتصحيح."""
import random
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.assessment import (
    EXPIRED, IN_PROGRESS, SUBMITTED, Assessment, AssessmentAttempt, AttemptAnswer,
    Question, QuestionChoice, QuestionType,
)
from app.models.mixins import utcnow

# سماح بسيط (تأخر الشبكة) بعد انتهاء الوقت قبل ما نعتبر المحاولة منتهية
GRACE = timedelta(seconds=60)

LOCKED_MESSAGE = "لا يمكن تعديل الأسئلة بعد أن بدأ طلاب في حل هذا الاختبار، حفاظاً على نتائجهم."


def attempts_count(db: Session, assessment_id: int) -> int:
    return db.scalar(
        select(func.count(AssessmentAttempt.id)).where(AssessmentAttempt.assessment_id == assessment_id)
    ) or 0


def ensure_unlocked(db: Session, assessment_id: int) -> None:
    if attempts_count(db, assessment_id) > 0:
        raise HTTPException(409, LOCKED_MESSAGE)


def validate_choices(kind: QuestionType, choices) -> None:
    texts = [c.text.strip() for c in choices]
    if len(set(texts)) != len(texts):
        raise HTTPException(422, "الاختيارات لازم تكون مختلفة عن بعضها.")
    if sum(1 for c in choices if c.is_correct) != 1:
        raise HTTPException(422, "لازم تحدد إجابة صحيحة واحدة بالظبط.")
    if kind == QuestionType.true_false and len(choices) != 2:
        raise HTTPException(422, "سؤال صح/خطأ لازم يكون له اختياران بالظبط.")


def is_expired(attempt: AssessmentAttempt) -> bool:
    return attempt.deadline_at is not None and utcnow() > attempt.deadline_at + GRACE


def deadline_for(assessment: Assessment, started: datetime) -> datetime | None:
    if assessment.time_limit_minutes:
        return started + timedelta(minutes=assessment.time_limit_minutes)
    return None


def shuffled(items: list, seed: int, salt: int = 0) -> list:
    out = list(items)
    random.Random(seed * 1000003 + salt).shuffle(out)
    return out


def questions_with_choices(db: Session, assessment_id: int):
    questions = db.scalars(
        select(Question).where(Question.assessment_id == assessment_id)
        .order_by(Question.order_index, Question.id)
    ).all()
    by_question: dict[int, list[QuestionChoice]] = {q.id: [] for q in questions}
    if questions:
        choices = db.scalars(
            select(QuestionChoice).where(QuestionChoice.question_id.in_(list(by_question)))
            .order_by(QuestionChoice.order_index, QuestionChoice.id)
        ).all()
        for c in choices:
            by_question[c.question_id].append(c)
    return questions, by_question


def grade_and_finalize(
    db: Session, attempt: AssessmentAttempt, assessment: Assessment,
    answers: dict[int, int | None], *, status: str = SUBMITTED,
) -> None:
    """يصحح المحاولة ويحفظ الإجابات والنتيجة. الـ commit مسؤولية اللي بينادي."""
    questions, by_question = questions_with_choices(db, assessment.id)

    score = 0
    max_score = 0
    rows = []
    for q in questions:
        max_score += q.points
        chosen_id = answers.get(q.id)
        chosen = next((c for c in by_question[q.id] if c.id == chosen_id), None) if chosen_id else None
        correct = bool(chosen and chosen.is_correct)
        earned = q.points if correct else 0
        score += earned
        rows.append(AttemptAnswer(
            attempt_id=attempt.id, question_id=q.id,
            selected_choice_id=chosen.id if chosen else None,
            is_correct=correct, points_earned=earned,
        ))
    db.add_all(rows)

    attempt.score = score
    attempt.max_score = max_score
    attempt.percentage = round(score * 100 / max_score, 2) if max_score else 0
    attempt.is_passed = attempt.percentage >= assessment.passing_score
    attempt.status = status
    attempt.submitted_at = utcnow()


def expire_attempt(db: Session, attempt: AssessmentAttempt, assessment: Assessment) -> None:
    """محاولة الوقت خلص وماتسلّمتش: نقفلها بدرجة صفر."""
    grade_and_finalize(db, attempt, assessment, {}, status=EXPIRED)
    db.commit()
