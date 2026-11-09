from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class StudentProfile(TimestampMixin, Base):
    """بيانات الطالب الأساسية: صفه الدراسي. بتتغير عند ترقيته لصف أعلى."""
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), unique=True, index=True
    )
    grade_id: Mapped[int] = mapped_column(
        ForeignKey("grades.id", ondelete="RESTRICT"), index=True
    )
