import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Integer, String, Text, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.student import StudentProfile


class Role(str, enum.Enum):
    super_admin = "super_admin"  # المالك
    admin = "admin"
    teacher = "teacher"
    student = "student"
    parent = "parent"


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = lower(email)", name="ck_users_email_lower"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role", native_enum=False, length=20), index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    # يزيد عند تغيير كلمة المرور أو تعطيل الحساب، فيبطل كل التوكنات القديمة
    token_version: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    failed_login_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # approved = بيدخل عادي | pending = مستني موافقة | rejected = اتحفظ طلبه
    approval_status: Mapped[str] = mapped_column(
        String(20), default="approved", server_default="approved", nullable=False, index=True
    )
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    registration_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)

    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile", uselist=False, lazy="joined"
    )

    @property
    def grade_id(self) -> int | None:
        return self.student_profile.grade_id if self.student_profile else None
