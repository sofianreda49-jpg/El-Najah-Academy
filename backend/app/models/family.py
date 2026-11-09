from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Table, func

from app.db.base import Base

# ربط ولي الأمر بأبنائه (ولي الأمر الواحد ممكن يكون له أكتر من ابن، والطالب ممكن له أكتر من ولي أمر).
# الصف ده مجرد "رابط"، فحذف الحساب (لو حصل) بيشيل الرابط بس.
parent_student = Table(
    "parent_student",
    Base.metadata,
    Column("parent_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    CheckConstraint("parent_id <> student_id", name="ck_parent_student_not_self"),
    Index("ix_parent_student_student_id", "student_id"),
)
