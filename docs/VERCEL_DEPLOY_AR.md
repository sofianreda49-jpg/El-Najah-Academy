# نشر المنصة على Vercel (الباك إند + الواجهة)

هنعمل **مشروعين** على Vercel من نفس مستودع GitHub:

| المشروع | الـ Root Directory | الناتج |
|---|---|---|
| الباك إند (FastAPI) | `backend` | `https://اسم-الباك.vercel.app` |
| الواجهة (React) | `frontend` | `https://اسم-الواجهة.vercel.app` |

## ⚠️ حاجات لازم تعرفها
1. **خطة Hobby (المجانية) لاستخدام شخصي غير تجاري بس.** أكاديمية بتاخد اشتراكات = تجاري، فللتشغيل الحقيقي محتاج **Pro** (حوالي 20 دولار شهرياً، اتأكد من السعر الحالي). Hobby مناسبة لتجربة وبيانات وهمية.
2. **قاعدة البيانات لازم تكون على الإنترنت.** Vercel ما يقدرش يوصل لقاعدة على جهازك. استخدم Supabase أو Neon أو سيرفر PostgreSQL.
3. الباك إند على Vercel **Serverless**: أول طلب بعد فترة سكون ممكن ياخد ثواني (cold start)، ومفيش ملفات بتتكتب على السيرفر.
4. الـ Migrations **ما بتشتغلش على Vercel**. بنشغّلها من جهازك على قاعدة الإنتاج (خطوة 3).

## 1) ارفع المشروع على GitHub (مستودع Private)
```powershell
cd D:\Downloads\najah-backend-step1
git init
git add .
git status
git ls-files | findstr /i "\.env venv node_modules"
```
الأمر الأخير المفروض يطلّع `.env.example` بس. لو طلّع `.env` أو `venv` وقّف ومترفعش.
```powershell
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/najah-academy.git
git push -u origin main
```

## 2) جهّز قاعدة بيانات الإنتاج
- Supabase: اعمل مشروع في **Frankfurt (eu-central-1)**.
- هتحتاج رابطين:
  - **Session pooler (5432)**: للـ migrations من جهازك.
  - **Transaction pooler (6543)**: للمنصة على Vercel (نفس الرابط وغيّر البورت لـ 6543).
- صيغة الرابط: `postgresql+psycopg2://postgres.XXXX:PASSWORD@HOST:PORT/postgres`

## 3) جهّز الجداول من جهازك (مرة واحدة، وبعد كل تعديل في القاعدة)
```powershell
cd D:\Downloads\najah-backend-step1\backend
venv\Scripts\activate
$env:DATABASE_URL = "رابط-Session-pooler-بورت-5432"
alembic upgrade head
python -m app.scripts.enable_rls
python -m app.scripts.seed_academy
python -m app.scripts.create_owner
```
اقفل الـ Terminal بعدها (المتغير مؤقت).

## 4) مشروع الباك إند
1. على `vercel.com/new` اختار المستودع.
2. **Root Directory = `backend`**. الـ Framework المفروض يتعرّف عليه FastAPI.
3. **Environment Variables:**

| الاسم | القيمة |
|---|---|
| `DATABASE_URL` | رابط **Transaction pooler** (بورت 6543) |
| `DB_NULL_POOL` | `true` |
| `JWT_SECRET` | نص عشوائي طويل (32+ حرف). مختلف عن اللي على جهازك. توليده: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | مؤقتاً `http://localhost:5173` (هنغيّره في خطوة 6) |
| `GOOGLE_CLIENT_ID` | الـ Client ID (لو بتستخدم جوجل) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | اختياري، مثلاً `480` |

4. اضغط **Deploy**، وبعدها افتح `https://رابط-الباك.vercel.app/api/health`: المفروض يرجّع حالة سليمة.

## 5) مشروع الواجهة
1. مشروع جديد من نفس المستودع، **Root Directory = `frontend`** (الـ Framework: Vite).
2. **Environment Variable:** `VITE_API_URL` = رابط الباك إند **من غير `/` في الآخر**.
3. Deploy.

## 6) اربطهم ببعض
- في مشروع الباك إند: غيّر `CORS_ORIGINS` لرابط الواجهة بالظبط (`https://اسم-الواجهة.vercel.app`، من غير `/` في الآخر)، وبعدها **Redeploy** (تغيير المتغيرات ما بيتطبقش إلا بعد نشر جديد).
- في Google Cloud Console: أضف رابط الواجهة في **Authorized JavaScript origins**.

## 7) جرّب
- افتح رابط الواجهة وادخل بحساب المالك.
- من جهازك:
  `python -m app.scripts.security_smoke_test --base https://رابط-الباك.vercel.app`

## 8) دومين خاص (بعدين)
- الواجهة على `app.دومينك.com` والباك على `api.دومينك.com` (Settings > Domains في كل مشروع).
- حدّث: `VITE_API_URL`، و`CORS_ORIGINS`، وأصول جوجل. ولو الباك على دومين خاص أضفه في `connect-src` جوه `frontend/vercel.json`.

## مشاكل شائعة
| المشكلة | السبب والحل |
|---|---|
| الباك بيرجّع 500 | شوف Logs: Project > Deployments > (آخر نشر) > Functions/Logs. غالباً `DATABASE_URL` أو `JWT_SECRET` ناقص (أقل من 32 حرف)، أو `relation does not exist` (شغّل migrations خطوة 3) |
| خطأ CORS في المتصفح | `CORS_ORIGINS` لازم يطابق رابط الواجهة بالظبط (https، من غير `/` في الآخر) وبعدها Redeploy |
| الواجهة بتكلّم نفسها (404 على /api) | `VITE_API_URL` ناقص أو غلط في مشروع الواجهة، عدّله وأعد النشر |
| تسجيل جوجل مش شغّال | رابط الواجهة مش مضاف في Authorized origins |
| أول طلب بطيء | cold start عادي في Serverless |
| الروابط المؤقتة (Preview) بتطلب تسجيل دخول Vercel | ده حماية افتراضية. استخدم رابط **Production** |
