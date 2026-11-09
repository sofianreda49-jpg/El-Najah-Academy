from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.user import Role

FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
Password = Annotated[str, Field(min_length=8, max_length=128)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: Role
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime
    grade_id: int | None = None  # للطلاب فقط


class UserCreate(BaseModel):
    full_name: FullName
    email: EmailStr
    password: Password
    role: Role
    grade_id: int | None = None  # مطلوب لو الدور طالب


class UserUpdate(BaseModel):
    full_name: FullName | None = None
    is_active: bool | None = None
    grade_id: int | None = None  # تغيير صف الطالب


class ResetPasswordIn(BaseModel):
    new_password: Password


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    limit: int
