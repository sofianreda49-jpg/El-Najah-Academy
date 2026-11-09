"""يمسح جداول المشروع القديم فقط من الداتابيز (لو كنت بتستخدم نفس مشروع Supabase).

    python -m app.scripts.drop_legacy_tables

بيمسح الجداول المذكورة بالاسم بس، ومش بيلمس أي حاجة تانية في Supabase.
"""
from sqlalchemy import text

from app.db.session import engine

LEGACY_TABLES = [
    "assessment_answers", "assessment_attempts", "question_choices", "questions",
    "assessments", "lesson_progress", "teacher_assignments", "password_resets",
    "student_profiles", "lessons", "units", "courses", "subjects", "terms",
    "academic_years", "grades", "stages", "parent_student", "audit_logs",
    "users", "alembic_version",
]
LEGACY_TYPES = ["role", "assessment_type", "question_type"]


def main() -> None:
    print("Database:", engine.url.render_as_string(hide_password=True))
    print("الجداول اللي هتتمسح (لو موجودة):")
    for t in LEGACY_TABLES:
        print("  -", t)
    if input('اكتب DELETE بحروف كبيرة للتأكيد: ').strip() != "DELETE":
        raise SystemExit("تم الإلغاء.")

    with engine.begin() as conn:
        for t in LEGACY_TABLES:
            conn.execute(text(f'DROP TABLE IF EXISTS "{t}" CASCADE'))
        for t in LEGACY_TYPES:
            conn.execute(text(f'DROP TYPE IF EXISTS "{t}" CASCADE'))
    print("تم.")


if __name__ == "__main__":
    main()
