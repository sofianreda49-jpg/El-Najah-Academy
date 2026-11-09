from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


def _name(max_len: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=max_len)]


Name100 = _name(100)
Name150 = _name(150)
Name200 = _name(200)
Name250 = _name(250)
YearName = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{4}/\d{4}$")]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
LessonContent = Annotated[str, StringConstraints(max_length=50000)]
# روابط http/https فقط (يمنع javascript: وغيره)
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://\S+$")]
Order = Annotated[int, Field(ge=0, le=100000)]


class MessageOut(BaseModel):
    message: str


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------- Stage ----------------
class StageCreate(BaseModel):
    name: Name150
    description: Description | None = None
    order_index: Order = 0


class StageUpdate(BaseModel):
    name: Name150 | None = None
    description: Description | None = None
    order_index: Order | None = None


class StageOut(_Out):
    name: str
    description: str | None
    order_index: int


# ---------------- Grade ----------------
class GradeCreate(BaseModel):
    stage_id: int
    name: Name150
    order_index: Order = 0


class GradeUpdate(BaseModel):
    stage_id: int | None = None
    name: Name150 | None = None
    order_index: Order | None = None


class GradeOut(_Out):
    stage_id: int
    name: str
    order_index: int


# ---------------- Academic year ----------------
def _consecutive(v: str | None) -> str | None:
    if v is None:
        return v
    first, second = v.split("/")
    if int(second) != int(first) + 1:
        raise ValueError("السنة الدراسية لازم تكون متتالية مثل 2026/2027")
    return v


class AcademicYearCreate(BaseModel):
    name: YearName

    _check = field_validator("name")(_consecutive)


class AcademicYearUpdate(BaseModel):
    name: YearName | None = None

    _check = field_validator("name")(_consecutive)


class AcademicYearOut(_Out):
    name: str
    is_current: bool


# ---------------- Term ----------------
class TermCreate(BaseModel):
    academic_year_id: int
    name: Name100
    order_index: Order = 0


class TermUpdate(BaseModel):
    academic_year_id: int | None = None
    name: Name100 | None = None
    order_index: Order | None = None


class TermOut(_Out):
    academic_year_id: int
    name: str
    order_index: int


# ---------------- Subject ----------------
class SubjectCreate(BaseModel):
    name: Name150
    description: Description | None = None
    order_index: Order = 0


class SubjectUpdate(BaseModel):
    name: Name150 | None = None
    description: Description | None = None
    order_index: Order | None = None


class SubjectOut(_Out):
    name: str
    description: str | None
    order_index: int


# ---------------- Course ----------------
class CourseCreate(BaseModel):
    grade_id: int
    term_id: int
    subject_id: int
    name: Name200
    description: Description | None = None
    order_index: Order = 0
    is_published: bool = False
    access: Literal["grade", "enrolled"] = "grade"


class CourseUpdate(BaseModel):
    grade_id: int | None = None
    term_id: int | None = None
    subject_id: int | None = None
    name: Name200 | None = None
    description: Description | None = None
    order_index: Order | None = None
    is_published: bool | None = None
    access: Literal["grade", "enrolled"] | None = None


class CourseOut(_Out):
    grade_id: int
    term_id: int
    subject_id: int
    name: str
    description: str | None
    order_index: int
    is_published: bool
    access: str


# ---------------- Unit ----------------
class UnitCreate(BaseModel):
    course_id: int
    name: Name200
    description: Description | None = None
    order_index: Order = 0


class UnitUpdate(BaseModel):
    course_id: int | None = None
    name: Name200 | None = None
    description: Description | None = None
    order_index: Order | None = None


class UnitOut(_Out):
    course_id: int
    name: str
    description: str | None
    order_index: int


# ---------------- Lesson ----------------
class LessonCreate(BaseModel):
    unit_id: int
    title: Name250
    content: LessonContent | None = None
    video_url: Url | None = None
    file_url: Url | None = None
    order_index: Order = 0
    is_published: bool = False


class LessonUpdate(BaseModel):
    unit_id: int | None = None
    title: Name250 | None = None
    content: LessonContent | None = None
    video_url: Url | None = None
    file_url: Url | None = None
    order_index: Order | None = None
    is_published: bool | None = None


class LessonOut(_Out):
    unit_id: int
    title: str
    content: str | None
    video_url: str | None
    file_url: str | None
    order_index: int
    is_published: bool


# ---------------- مخطط الكورس الكامل (وحدات + دروس) ----------------
class UnitWithLessons(UnitOut):
    lessons: list[LessonOut] = []


class CourseOutline(CourseOut):
    units: list[UnitWithLessons] = []
