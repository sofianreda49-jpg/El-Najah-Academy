from sqlalchemy import Column, DateTime, ForeignKey, Index, Table, func

from app.db.base import Base

# طالب مضاف على كورس بالاسم (بيضيفه المعلم أو الإدارة). الصف ده رابط بس.
course_enrollment = Table(
    "course_enrollment",
    Base.metadata,
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("added_by", ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Index("ix_course_enrollment_student_id", "student_id"),
)
