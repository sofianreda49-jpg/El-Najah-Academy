"""اختبار أمان سريع على السيرفر الشغّال (للتطوير بس، من غير أي مكتبات إضافية).

    1) شغّل الباك إند (ENVIRONMENT=development علشان /openapi.json يكون متاح).
    2) python -m app.scripts.security_smoke_test
    3) اكتب إيميل وباسورد حساب لكل دور (أو سيب الدور فاضي لو مش عندك حساب منه).

بيتأكد من:
  - كل مسار محمي بيرفض الطلب من غير تسجيل دخول (401).
  - كل دور بيوصل لمساراته بس، ومحجوب (403) عن مسارات الأدوار التانية.
  - رسالة تسجيل الدخول الغلط واحدة سواء الإيميل موجود أو لا (مفيش كشف لحسابات).
  - الـ headers الأمنية موجودة.
  - الطلبات على موارد مش موجودة بترجع 404 مش 500.
بيقرأ بس، ومش بيغيّر أي بيانات. (حسابات لسه محتاجة تغيير كلمة مرور مؤقتة هتدّي 403، غيّرها الأول.)
"""
import argparse
import getpass
import json
import re
import sys
import urllib.error
import urllib.request

PUBLIC = {
    ("POST", "/api/auth/login"), ("GET", "/api/auth/public-config"), ("POST", "/api/auth/google"),
    ("POST", "/api/auth/google/register"), ("GET", "/api/health"),
}

# الدور -> (مسارات لازم تتفتح 200، مسارات لازم تتقفل 403)
MATRIX = {
    "student": (
        ["/api/student/home", "/api/student/dashboard", "/api/student/results", "/api/auth/me"],
        ["/api/users", "/api/admin/overview", "/api/academy/courses", "/api/registrations", "/api/audit-logs",
         "/api/parent/children", "/api/teacher/courses", "/api/assessments?course_id=1"],
    ),
    "parent": (
        ["/api/parent/children", "/api/parent/dashboard", "/api/auth/me"],
        ["/api/student/home", "/api/users", "/api/admin/overview", "/api/academy/courses", "/api/teacher/courses",
         "/api/audit-logs", "/api/registrations"],
    ),
    "teacher": (
        ["/api/teacher/courses", "/api/teacher/overview", "/api/academy/courses", "/api/academy/stages", "/api/auth/me"],
        ["/api/users", "/api/admin/overview", "/api/registrations", "/api/audit-logs", "/api/student/home",
         "/api/parent/children"],
    ),
    "admin": (
        ["/api/users", "/api/admin/overview", "/api/registrations", "/api/academy/courses", "/api/auth/me"],
        ["/api/audit-logs", "/api/student/home", "/api/teacher/courses", "/api/parent/children"],
    ),
    "super_admin": (
        ["/api/users", "/api/admin/overview", "/api/registrations", "/api/academy/courses", "/api/audit-logs", "/api/auth/me"],
        ["/api/student/home", "/api/teacher/courses", "/api/parent/children"],
    ),
}
NOT_FOUND_CHECKS = {
    "student": ["/api/student/attempts/99999999", "/api/student/lessons/99999999", "/api/student/courses/99999999"],
    "parent": ["/api/parent/children/99999999"],
    "teacher": ["/api/teacher/courses/99999999", "/api/teacher/assessments/99999999/results"],
}

results = []


def record(ok, label, detail=""):
    results.append(ok)
    print(("  ✅ " if ok else "  ❌ ") + label + (f"   [{detail}]" if detail and not ok else ""))


def call(base, method, path, token=None, body=None):
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)
    except urllib.error.URLError as e:
        sys.exit(f"تعذر الاتصال بالسيرفر على {base}: {e.reason}\nتأكد إن الباك إند شغّال.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    base = ap.parse_args().base.rstrip("/")

    print("\n1) كل المسارات المحمية بترفض الطلب من غير تسجيل دخول")
    status, text, _ = call(base, "GET", "/openapi.json")
    if status != 200:
        print("  ⚠️ /openapi.json مش متاح (ENVIRONMENT=production؟). هنتخطى الفحص الشامل.")
    else:
        spec = json.loads(text)
        for path, methods in sorted(spec["paths"].items()):
            for method in methods:
                m = method.upper()
                if m not in ("GET", "POST", "PUT", "PATCH", "DELETE") or (m, path) in PUBLIC:
                    continue
                url = re.sub(r"\{[^}]+\}", "1", path)
                st, _, _ = call(base, m, url, body={} if m in ("POST", "PUT", "PATCH") else None)
                record(st == 401, f"{m} {path} من غير توكن -> {st}", f"المتوقع 401، رجع {st}")

    print("\n2) الـ headers الأمنية")
    _, _, headers = call(base, "GET", "/api/health")
    low = {k.lower(): v for k, v in headers.items()}
    for h in ("x-content-type-options", "x-frame-options", "referrer-policy", "cache-control"):
        record(h in low, f"header {h}", "ناقص")

    print("\n3) رسالة الدخول الغلط واحدة (مفيش كشف لحسابات)")
    accounts = {}
    for role in MATRIX:
        email = input(f"\nإيميل حساب {role} (سيبه فاضي للتخطي): ").strip()
        if email:
            accounts[role] = (email, getpass.getpass("  كلمة المرور: "))
    if accounts:
        any_email = next(iter(accounts.values()))[0]
        s1, t1, _ = call(base, "POST", "/api/auth/login", body={"email": any_email, "password": "wrong-password-xyz"})
        s2, t2, _ = call(base, "POST", "/api/auth/login", body={"email": "nobody-here-123@example.com", "password": "wrong-password-xyz"})
        same = s1 == s2 == 401 and json.loads(t1).get("detail") == json.loads(t2).get("detail")
        record(same, "نفس الرد لإيميل موجود وإيميل غير موجود", f"{s1} vs {s2}")

    print("\n4) صلاحيات كل دور")
    for role, (email, password) in accounts.items():
        st, text, _ = call(base, "POST", "/api/auth/login", body={"email": email, "password": password})
        if st != 200:
            print(f"  ⚠️ فشل دخول {role} ({st}) - هنتخطاه")
            continue
        token = json.loads(text)["access_token"]
        print(f"\n  --- {role}")
        allowed, forbidden = MATRIX[role]
        for path in allowed:
            st, _, _ = call(base, "GET", path, token)
            record(st == 200, f"{path} متاح -> {st}", f"المتوقع 200، رجع {st}")
        for path in forbidden:
            st, _, _ = call(base, "GET", path, token)
            record(st in (401, 403), f"{path} محجوب -> {st}", f"المتوقع 403، رجع {st}")
        for path in NOT_FOUND_CHECKS.get(role, []):
            st, _, _ = call(base, "GET", path, token)
            record(st == 404, f"{path} مورد غير موجود -> {st}", f"المتوقع 404، رجع {st}")

    failed = results.count(False)
    print(f"\n==== النتيجة: {results.count(True)} نجح | {failed} فشل ====")
    if failed:
        print("أي ❌ فوق = مشكلة صلاحيات محتاجة مراجعة. ابعتهالي.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
