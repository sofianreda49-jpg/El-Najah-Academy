"""يمسح كل جداول الداتابيز المتصلة بيها، علشان نبنيها من جديد بالـ migrations.

    python -m app.scripts.reset_database

للتجربة بس: بيمسح كل الداتا اللي في الـ schema اسمه public.
بيعرض لك اسم الداتابيز وكل الجداول قبل ما يمسح، ولازم تكتب DELETE للتأكيد.
"""
from sqlalchemy import text

from app.db.session import engine


def main() -> None:
    print("Database:", engine.url.render_as_string(hide_password=True))

    with engine.connect() as conn:
        tables = [r[0] for r in conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"))]
        enums = [r[0] for r in conn.execute(text(
            "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace "
            "WHERE n.nspname = 'public' AND t.typtype = 'e'"))]

    if not tables and not enums:
        print("الداتابيز فاضية بالفعل. كمّل بـ: alembic upgrade head")
        return

    print(f"الجداول اللي هتتمسح ({len(tables)}):")
    for t in tables:
        print("  -", t)
    if enums:
        print("أنواع Enum اللي هتتمسح:", ", ".join(enums))

    if input("اتأكد إنها الداتابيز التجريبية. اكتب DELETE بحروف كبيرة للتأكيد: ").strip() != "DELETE":
        raise SystemExit("تم الإلغاء.")

    with engine.begin() as conn:
        for t in tables:
            conn.execute(text(f'DROP TABLE IF EXISTS "public"."{t}" CASCADE'))
        for e in enums:
            conn.execute(text(f'DROP TYPE IF EXISTS "public"."{e}" CASCADE'))
    print("تم. الخطوة الجاية: alembic upgrade head")


if __name__ == "__main__":
    main()
