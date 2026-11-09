"""فحص سريع لحالة الداتابيز: هل الجداول والأعمدة موجودة؟ وهل فيه مالك وبيانات أساسية؟

    python -m app.scripts.check_setup

بيقرأ بس، ومش بيغيّر أي حاجة.
"""
from sqlalchemy import func, inspect, select, text

import app.models  # noqa: F401  (تسجيل كل الجداول)
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.academic import AcademicYear, Course, Grade, Stage, Subject
from app.models.user import Role, User


def main() -> None:
    print("Database:", engine.url.render_as_string(hide_password=True))
    print("GOOGLE_CLIENT_ID مضبوط؟", "نعم" if get_settings().GOOGLE_CLIENT_ID else "لا (زر جوجل مش هيظهر)")

    insp = inspect(engine)
    existing = set(insp.get_table_names())

    revision = None
    if "alembic_version" in existing:
        with engine.connect() as conn:
            revision = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    print("نسخة الـ migration في الداتابيز:", revision or "مفيش (الداتابيز مابنيتش بالـ migrations)")

    problems = []
    for name, table in Base.metadata.tables.items():
        if name not in existing:
            problems.append(f"جدول ناقص: {name}")
            continue
        db_columns = {c["name"] for c in insp.get_columns(name)}
        missing = [c.name for c in table.columns if c.name not in db_columns]
        if missing:
            problems.append(f"أعمدة ناقصة في {name}: {', '.join(missing)}")

    if problems:
        print("\n❌ الداتابيز مش متوافقة مع الكود:")
        for p in problems:
            print("  -", p)
        print("\nالحل: من فولدر backend ومعاك (venv):\n  alembic upgrade head")
        print("ولو لسه ظهرت أعمدة/جداول ناقصة بعدها:\n  alembic revision --autogenerate -m \"sync\"\n  alembic upgrade head")
        return

    print("\n✅ الجداول والأعمدة كلها سليمة.")

    # فحص الأمان: Row Level Security
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            open_tables = [r[0] for r in conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity ORDER BY tablename"))]
        if open_tables:
            print("🔓 جداول مفتوحة للوصول المباشر (خطر لو الداتابيز على Supabase):", ", ".join(open_tables))
            print("   الحل: python -m app.scripts.enable_rls")
        else:
            print("🔒 كل الجداول مقفولة بـ RLS.")
    with SessionLocal() as db:
        owners = db.scalar(select(func.count(User.id)).where(User.role == Role.super_admin)) or 0
        users = db.scalar(select(func.count(User.id))) or 0
        stages = db.scalar(select(func.count(Stage.id))) or 0
        grades = db.scalar(select(func.count(Grade.id))) or 0
        subjects = db.scalar(select(func.count(Subject.id))) or 0
        courses = db.scalar(select(func.count(Course.id))) or 0
        current_year = db.scalar(select(AcademicYear.name).where(AcademicYear.is_current.is_(True)))

    print(f"المستخدمين: {users} | المالك: {owners} | المراحل: {stages} | الصفوف: {grades} | المواد: {subjects} | الكورسات: {courses}")
    print("السنة الحالية:", current_year or "غير محددة")

    if owners == 0:
        print("⚠️ مفيش حساب مالك. شغّل: python -m app.scripts.create_owner")
    if grades == 0:
        print("⚠️ مفيش صفوف. شغّل: python -m app.scripts.seed_academy")
    if owners and grades:
        print("كل حاجة جاهزة. لو الواجهة لسه بيضا، المشكلة في المتصفح (افتح F12 وشوف Console).")


if __name__ == "__main__":
    main()
