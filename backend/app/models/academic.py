"""الهيكل التعليمي (التصميم الجديد):

    Stage ─ Grade ─────────────┐
    AcademicYear ─ Term ───────┼─► Course ─ Unit ─ Lesson
    Subject (كتالوج مستقل) ────┘

السنة الدراسية والترم والمادة بتتعرّف مرة واحدة، والكورس هو اللي بيربط
(صف + ترم + مادة). فسنة جديدة = إدخال واحد، مش تكرار لكل صف.
كل الـ Foreign Keys بـ RESTRICT: مفيش حذف متسلسل أبداً.
"""
from sqlalchemy import (
    Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint, false, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import ActiveMixin, TimestampMixin


def _order() -> Mapped[int]:
    return mapped_column(Integer, default=0, server_default=text("0"), nullable=False)


class Stage(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = _order()


class Grade(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("stage_id", "name", name="uq_grade_stage_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        ForeignKey("stages.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(150))
    order_index: Mapped[int] = _order()


class AcademicYear(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "academic_years"
    __table_args__ = (
        # سنة "حالية" واحدة فقط على مستوى الداتابيز نفسها
        Index("uq_one_current_year", "is_current", unique=True,
              postgresql_where=text("is_current")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)  # مثل 2026/2027
    is_current: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )


class Term(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "terms"
    __table_args__ = (
        UniqueConstraint("academic_year_id", "name", name="uq_term_year_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    academic_year_id: Mapped[int] = mapped_column(
        ForeignKey("academic_years.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    order_index: Mapped[int] = _order()


class Subject(TimestampMixin, ActiveMixin, Base):
    """كتالوج المواد: بيتعرّف مرة ويتستخدم في كل الصفوف."""
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = _order()


class Course(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint(
            "grade_id", "term_id", "subject_id", "name", name="uq_course_unique"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade_id: Mapped[int] = mapped_column(
        ForeignKey("grades.id", ondelete="RESTRICT"), index=True
    )
    term_id: Mapped[int] = mapped_column(
        ForeignKey("terms.id", ondelete="RESTRICT"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = _order()
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    # grade = كل طلاب الصف يشوفوه | enrolled = الطلاب المضافين يدوياً بس
    access: Mapped[str] = mapped_column(
        String(20), default="grade", server_default="grade", nullable=False
    )


class Unit(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_unit_course_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = _order()


class Lesson(TimestampMixin, ActiveMixin, Base):
    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("unit_id", "title", name="uq_lesson_unit_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    unit_id: Mapped[int] = mapped_column(
        ForeignKey("units.id", ondelete="RESTRICT"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order_index: Mapped[int] = _order()
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
