"""الاختبارات: اختبار ← أسئلة ← اختيارات، ومحاولات الطلاب وإجاباتهم.

قواعد سلامة البيانات:
- نتائج الطلاب (المحاولات والإجابات) مش بتتمسح أبداً: كل الـ FK بـ RESTRICT.
- أول ما طالب يبدأ الاختبار، الأسئلة والاختيارات بتتقفل (علشان نتيجته القديمة ما تتغيرش).
- كل محاولة ليها سطر مستقل، والمحاولة الجديدة مش بتستبدل القديمة.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Enum, Float, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint, func, false,
)
from sqlalchemy import text as sa_text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import ActiveMixin, TimestampMixin, utcnow


class AssessmentType(str, enum.Enum):
    quiz = "quiz"   # اختبار قصير
    exam = "exam"   # امتحان


class QuestionType(str, enum.Enum):
    mcq = "mcq"                 # اختيار من متعدد
    true_false = "true_false"   # صح أو خطأ


# حالات المحاولة
IN_PROGRESS = "in_progress"
SUBMITTED = "submitted"
EXPIRED = "expired"  # الوقت خلص وما اتسلّمتش


class Assessment(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "assessments"
    __table_args__ = (
        CheckConstraint("passing_score BETWEEN 0 AND 100", name="ck_assessment_passing"),
        CheckConstraint("max_attempts >= 1", name="ck_assessment_attempts"),
        CheckConstraint("time_limit_minutes IS NULL OR time_limit_minutes > 0", name="ck_assessment_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"), index=True)
    lesson_id: Mapped[int | None] = mapped_column(
        ForeignKey("lessons.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[AssessmentType] = mapped_column(
        Enum(AssessmentType, name="assessment_kind", native_enum=False, length=20),
        default=AssessmentType.quiz,
    )
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passing_score: Mapped[int] = mapped_column(Integer, default=50, server_default=sa_text("50"))
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, server_default=sa_text("1"))
    show_answers: Mapped[bool] = mapped_column(Boolean, default=True, server_default=sa_text("true"))
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    shuffle_choices: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Question(TimestampMixin, Base):
    __tablename__ = "questions"
    __table_args__ = (CheckConstraint("points > 0", name="ck_question_points"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="RESTRICT"), index=True
    )
    kind: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, name="question_kind", native_enum=False, length=20)
    )
    text: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=1, server_default=sa_text("1"))
    order_index: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))


class QuestionChoice(Base):
    __tablename__ = "question_choices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    order_index: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    __table_args__ = (
        UniqueConstraint("student_id", "assessment_id", "attempt_number", name="uq_attempt_number"),
        # محاولة مفتوحة واحدة بس لكل (طالب، اختبار): بيمنع الضغطة المزدوجة
        Index("uq_one_open_attempt", "student_id", "assessment_id", unique=True,
              postgresql_where=sa_text("status = 'in_progress'")),
        CheckConstraint("score >= 0 AND max_score >= 0", name="ck_attempt_scores"),
        CheckConstraint("percentage BETWEEN 0 AND 100", name="ck_attempt_percentage"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="RESTRICT"), index=True
    )
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default=IN_PROGRESS, server_default=IN_PROGRESS)
    shuffle_seed: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))
    max_score: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))
    percentage: Mapped[float] = mapped_column(Float, default=0, server_default=sa_text("0"))
    is_passed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_answer_attempt_question"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="RESTRICT"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="RESTRICT"), index=True)
    selected_choice_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_choices.id", ondelete="RESTRICT"), nullable=True
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    points_earned: Mapped[int] = mapped_column(Integer, default=0, server_default=sa_text("0"))
