from sqlalchemy import Column, DateTime, ForeignKey, Index, Table, func

from app.db.base import Base

# تعيين معلم على كورس (المعلم ممكن يكون عنده كذا كورس، والكورس ممكن له أكتر من معلم).
# الصف ده مجرد "رابط" بين حسابين محتواهم محفوظ في مكان تاني.
teacher_course = Table(
    "teacher_course",
    Base.metadata,
    Column("teacher_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Index("ix_teacher_course_course_id", "course_id"),
)
