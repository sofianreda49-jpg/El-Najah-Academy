from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.models.user import Role
from app.schemas.user import UserOut

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]

RegisterRole = Literal["student", "parent", "teacher"]


class GradeOption(BaseModel):
    id: int
    name: str


class PublicConfig(BaseModel):
    google_client_id: str | None
    grades: list[GradeOption]


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class GoogleLoginOut(BaseModel):
    status: Literal["ok", "needs_registration", "pending", "rejected"]
    message: str | None = None
    # status == ok
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserOut | None = None
    # status == needs_registration
    registration_token: str | None = None
    email: str | None = None
    name: str | None = None


class GoogleRegisterIn(BaseModel):
    registration_token: str = Field(min_length=20, max_length=4096)
    role: RegisterRole
    full_name: Name
    grade_id: int | None = None
    note: Note | None = None


class GoogleRegisterOut(BaseModel):
    # pending = مستني موافقة | ok = اتفعّل فوراً ومعاه توكن دخول
    status: Literal["pending", "ok"] = "pending"
    message: str
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserOut | None = None


class RegistrationOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: Role
    grade_id: int | None
    note: str | None
    approval_status: str
    rejection_reason: str | None
    created_at: datetime


class RegistrationPage(BaseModel):
    items: list[RegistrationOut]
    total: int
    page: int
    limit: int


class ApproveIn(BaseModel):
    role: RegisterRole | None = None   # اختياري: تغيير الدور المطلوب
    grade_id: int | None = None        # لو الدور بقى طالب ومعندوش صف


class RejectIn(BaseModel):
    reason: Reason | None = None


class AddStudentIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=255)]


class EnrolledStudent(BaseModel):
    id: int
    full_name: str
    email: str
    grade_name: str | None
