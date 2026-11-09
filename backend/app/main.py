from fastapi import Depends, FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.core.i18n import request_lang, translate
from app.routers import (
    academy, assessments, audit, auth, enrollments, family, google_auth, parent, registrations,
    admin_overview, parent_dashboard, profile, student, student_assessments, student_dashboard, teacher,
    student_learning, teacher_overview, teaching, users,
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    # صفحات التوثيق مقفولة في الإنتاج
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

@app.exception_handler(StarletteHTTPException)
async def localized_http_exception(request: Request, exc: StarletteHTTPException):
    # رسائل الأخطاء بترجع بلغة الواجهة (Accept-Language)
    if isinstance(exc.detail, str):
        exc.detail = translate(exc.detail, request_lang(request))
    return await http_exception_handler(request, exc)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    # ردود الـ API فيها بيانات شخصية: ممنوع تتخزن في أي كاش
    response.headers["Cache-Control"] = "no-store"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=False,  # بنستخدم Authorization header مش كوكيز
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(google_auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(academy.router, prefix="/api")
app.include_router(student.router, prefix="/api")
app.include_router(student_dashboard.router, prefix="/api")
app.include_router(student_learning.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(admin_overview.router, prefix="/api")
app.include_router(teacher_overview.router, prefix="/api")
app.include_router(parent_dashboard.router, prefix="/api")
app.include_router(student_assessments.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(family.router, prefix="/api")
app.include_router(parent.router, prefix="/api")
app.include_router(teaching.router, prefix="/api")
app.include_router(teacher.router, prefix="/api")
app.include_router(enrollments.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "app": settings.APP_NAME}
