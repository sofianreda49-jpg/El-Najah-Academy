from pydantic import BaseModel


class GradeRef(BaseModel):
    id: int
    name: str


class CourseCard(BaseModel):
    id: int
    name: str
    description: str | None
    subject_name: str
    term_name: str
    total_lessons: int
    completed_lessons: int


class StudentHome(BaseModel):
    grade: GradeRef | None
    year: str | None
    courses: list[CourseCard]
    total_lessons: int
    completed_lessons: int


class LessonItem(BaseModel):
    id: int
    title: str
    has_video: bool
    has_file: bool
    is_completed: bool


class UnitItem(BaseModel):
    id: int
    name: str
    description: str | None
    lessons: list[LessonItem]


class CourseView(BaseModel):
    id: int
    name: str
    description: str | None
    subject_name: str
    term_name: str
    total_lessons: int
    completed_lessons: int
    next_lesson_id: int | None
    units: list[UnitItem]


class CourseRef(BaseModel):
    id: int
    name: str


class LessonView(BaseModel):
    id: int
    title: str
    content: str | None
    video_url: str | None
    file_url: str | None
    unit_name: str
    course: CourseRef
    is_completed: bool
    prev_id: int | None
    next_id: int | None
    position: int
    total: int
