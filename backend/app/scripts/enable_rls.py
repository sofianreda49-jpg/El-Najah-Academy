"""يقفل الوصول المباشر لجداول الداتابيز من خارج الباك إند (Supabase Data API).

    python -m app.scripts.enable_rls

ليه ده مهم؟ Supabase بتعرض جداول schema "public" على إنترنت عبر Data API، وأي حد معاه
الـ anon/publishable key (وده مفتاح مصمم يتحط في الواجهات) يقدر يقرأ ويكتب في أي جدول
مش مفعّل عليه Row Level Security. الباك إند بتاعنا بيدخل بدور صاحب الجداول فبيتخطى RLS،
فتفعيله من غير policies بيقفل الباب على أي حد تاني من غير ما يأثر على المنصة.

آمن تشغّله أكتر من مرة، وشغّله بعد كل migration جديد (أو سيبه ضمن أمر تشغيل السيرفر).
"""
from sqlalchemy import text

from app.db.session import engine

LOCK_SQL = """
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;

  -- حزام أمان تاني: نشيل صلاحيات أدوار Supabase العامة (لو موجودة) من الجداول
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r.rolname);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r.rolname);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r.rolname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'تعذر سحب صلاحيات % : %', r.rolname, SQLERRM;
    END;
  END LOOP;
END $$;
"""


def main() -> None:
    if engine.dialect.name != "postgresql":
        raise SystemExit("السكريبت ده لـ PostgreSQL بس.")
    print("Database:", engine.url.render_as_string(hide_password=True))

    with engine.begin() as conn:
        conn.execute(text(LOCK_SQL))
        rows = conn.execute(text(
            "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )).all()

    unlocked = [name for name, enabled in rows if not enabled]
    print(f"الجداول: {len(rows)} | مقفولة بـ RLS: {len(rows) - len(unlocked)}")
    if unlocked:
        print("⚠️ لسه مفتوحة:", ", ".join(unlocked))
    else:
        print("✅ كل الجداول مقفولة أمام الوصول المباشر. الباك إند لسه شغّال عادي.")


if __name__ == "__main__":
    main()
