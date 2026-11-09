from pydantic import BaseModel, Field


class AssignedCourses(BaseModel):
    course_ids: list[int] = Field(default_factory=list, max_length=500)


class TeacherCourseCard(BaseModel):
    id: int
    name: str
    subject_name: str
    grade_name: str
    term_name: str
    student_count: int
    total_lessons: int
    assessments_count: int
    average_percentage: float | None


class TeacherStudentRow(BaseModel):
    id: int
    full_name: str
    completed_lessons: int
    total_lessons: int
    attempts_count: int
    average_percentage: float | None


class TeacherAssessmentRow(BaseModel):
    id: int
    title: str
    is_published: bool
    question_count: int
    attempts_count: int
    average_percentage: float | None
    pass_rate: float | None


class TeacherCourseDetail(BaseModel):
    id: int
    name: str
    description: str | None
    subject_name: str
    grade_name: str
    term_name: str
    total_lessons: int
    students: list[TeacherStudentRow]
    assessments: list[TeacherAssessmentRow]
