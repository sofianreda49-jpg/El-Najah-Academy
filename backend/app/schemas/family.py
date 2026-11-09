from pydantic import BaseModel

from app.schemas.assessment import ResultRow
from app.schemas.student import StudentHome


class ChildRef(BaseModel):
    id: int
    full_name: str
    email: str
    grade_id: int | None


class ChildSummary(BaseModel):
    id: int
    full_name: str
    grade_name: str | None
    total_lessons: int
    completed_lessons: int
    attempts_count: int
    average_percentage: float | None


class ChildDetail(BaseModel):
    id: int
    full_name: str
    overview: StudentHome
    results: list[ResultRow]
