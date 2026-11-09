from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.assessment import AssessmentType, QuestionType

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=250)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
QuestionText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=3000)]
ChoiceText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


# ======================= الإدارة =======================
class AssessmentCreate(BaseModel):
    course_id: int
    lesson_id: int | None = None
    title: Title
    description: LongText | None = None
    kind: AssessmentType = AssessmentType.quiz
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    passing_score: int = Field(default=50, ge=0, le=100)
    max_attempts: int = Field(default=1, ge=1, le=20)
    show_answers: bool = True
    shuffle_questions: bool = False
    shuffle_choices: bool = False


class AssessmentUpdate(BaseModel):
    lesson_id: int | None = None
    title: Title | None = None
    description: LongText | None = None
    kind: AssessmentType | None = None
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    passing_score: int | None = Field(default=None, ge=0, le=100)
    max_attempts: int | None = Field(default=None, ge=1, le=20)
    show_answers: bool | None = None
    shuffle_questions: bool | None = None
    shuffle_choices: bool | None = None
    is_published: bool | None = None


class ChoiceIn(BaseModel):
    text: ChoiceText
    is_correct: bool = False


class QuestionIn(BaseModel):
    kind: QuestionType
    text: QuestionText
    explanation: LongText | None = None
    points: int = Field(default=1, ge=1, le=100)
    order_index: int = Field(default=0, ge=0, le=100000)
    choices: list[ChoiceIn] = Field(min_length=2, max_length=6)


class ChoiceStaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    is_correct: bool
    order_index: int


class QuestionStaffOut(BaseModel):
    id: int
    kind: QuestionType
    text: str
    explanation: str | None
    points: int
    order_index: int
    choices: list[ChoiceStaffOut]


class AssessmentListItem(BaseModel):
    id: int
    course_id: int
    lesson_id: int | None
    title: str
    kind: AssessmentType
    is_published: bool
    time_limit_minutes: int | None
    passing_score: int
    max_attempts: int
    question_count: int
    attempts_count: int


class AssessmentDetail(AssessmentListItem):
    description: str | None
    show_answers: bool
    shuffle_questions: bool
    shuffle_choices: bool
    is_locked: bool
    questions: list[QuestionStaffOut]


class AttemptRow(BaseModel):
    id: int
    student_id: int
    student_name: str
    attempt_number: int
    status: str
    score: int
    max_score: int
    percentage: float
    is_passed: bool
    submitted_at: datetime | None


class ResultsSummary(BaseModel):
    attempts: int
    students: int
    average_percentage: float
    pass_rate: float


class AttemptPage(BaseModel):
    items: list[AttemptRow]
    total: int
    page: int
    limit: int
    summary: ResultsSummary


# ======================= الطالب =======================
class AttemptSummary(BaseModel):
    id: int
    attempt_number: int
    status: str
    score: int
    max_score: int
    percentage: float
    is_passed: bool
    submitted_at: datetime | None


class StudentAssessmentItem(BaseModel):
    id: int
    title: str
    kind: AssessmentType
    question_count: int
    time_limit_minutes: int | None
    passing_score: int
    max_attempts: int
    attempts_used: int
    best_percentage: float | None
    passed: bool
    can_start: bool
    open_attempt_id: int | None


class StudentAssessmentInfo(StudentAssessmentItem):
    description: str | None
    course_id: int
    attempts: list[AttemptSummary]


class TakeChoice(BaseModel):
    id: int
    text: str


class TakeQuestion(BaseModel):
    id: int
    kind: QuestionType
    text: str
    points: int
    choices: list[TakeChoice]


class ReviewChoice(BaseModel):
    id: int
    text: str
    is_correct: bool
    selected: bool


class ReviewQuestion(BaseModel):
    id: int
    kind: QuestionType
    text: str
    points: int
    earned: int
    answered: bool
    is_correct: bool
    explanation: str | None
    choices: list[ReviewChoice]


class AnswerIn(BaseModel):
    question_id: int
    choice_id: int | None = None


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=500)


class AttemptDetail(BaseModel):
    id: int
    assessment_id: int
    assessment_title: str
    course_id: int
    status: str
    attempt_number: int
    started_at: datetime
    deadline_at: datetime | None
    server_time: datetime
    passing_score: int
    # أثناء الحل
    questions: list[TakeQuestion] | None = None
    # بعد التسليم
    score: int | None = None
    max_score: int | None = None
    percentage: float | None = None
    is_passed: bool | None = None
    is_full_mark: bool = False
    submitted_at: datetime | None = None
    can_retry: bool = False
    review: list[ReviewQuestion] | None = None


class ResultRow(BaseModel):
    attempt_id: int
    assessment_id: int
    assessment_title: str
    course_name: str
    attempt_number: int
    status: str
    score: int
    max_score: int
    percentage: float
    is_passed: bool
    submitted_at: datetime | None
