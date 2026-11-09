"""إنشاء حساب المالك (super_admin). يتشغل من فولدر backend:

    python -m app.scripts.create_owner

الباسورد بيتكتب في الـ Terminal ومش بيتخزن في أي ملف.
"""
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import Role, User
from app.services.users import normalize_email


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == Role.super_admin)):
            sys.exit("فيه حساب مالك موجود بالفعل. لن يتم إنشاء حساب تاني.")

        full_name = input("الاسم الكامل: ").strip()
        email = normalize_email(input("البريد الإلكتروني: "))
        if len(full_name) < 2 or "@" not in email:
            sys.exit("الاسم أو البريد غير صحيح.")

        password = getpass.getpass("كلمة المرور (12 حرف على الأقل): ")
        if len(password) < 12:
            sys.exit("كلمة المرور قصيرة. استخدم 12 حرف على الأقل.")
        if getpass.getpass("أعد كتابة كلمة المرور: ") != password:
            sys.exit("كلمتا المرور غير متطابقتين.")

        db.add(
            User(
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                role=Role.super_admin,
                must_change_password=False,
            )
        )
        db.commit()
        print(f"تم إنشاء حساب المالك: {email}")


if __name__ == "__main__":
    main()
