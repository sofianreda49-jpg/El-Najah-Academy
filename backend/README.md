# El Najah Academy — Backend

FastAPI + PostgreSQL (Supabase) + Alembic.

## التشغيل لأول مرة (Windows / PowerShell، من فولدر backend)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

copy .env.example .env      # ثم افتح .env واملأ DATABASE_URL و JWT_SECRET

# فقط لو بتستخدم نفس مشروع Supabase القديم (بيمسح جداول المنصة القديمة بالاسم):
python -m app.scripts.drop_legacy_tables

alembic revision --autogenerate -m "initial"
alembic upgrade head

python -m app.scripts.create_owner
uvicorn app.main:app --reload
```

بعدها افتح http://127.0.0.1:8000/docs

## أي تعديل في الجداول بعد كده

1. عدّل ملف الموديل.
2. `alembic revision --autogenerate -m "وصف التعديل"`
3. راجع الملف الجديد في `alembic/versions/`
4. `alembic upgrade head`

مفيش `create_all` ولا مسح داتابيز. كل تعديل بيتطبق على الداتا الموجودة بأمان.

## قواعد الصلاحيات

- **المالك (super_admin)**: بيتعمل مرة واحدة بالسكريبت فقط، مش من الـ API. ما يتعدلش ولا يتعطل من أي حساب.
- **المدير (admin)**: بينشئ ويدير معلم/طالب/ولي أمر فقط، ومش بيشوف حساب المالك.
- الحسابات الجديدة بكلمة مرور مؤقتة، والمستخدم لازم يغيّرها أول دخول.
- بعد 5 محاولات دخول فاشلة الحساب بيتقفل 15 دقيقة.
- مفيش حذف مستخدمين: التعطيل بس.
