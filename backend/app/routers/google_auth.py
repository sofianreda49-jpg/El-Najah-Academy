"""تسجيل الدخول والتسجيل الجديد بحساب جوجل.

التدفق:
1) الواجهة بتاخد credential من جوجل وتبعته لـ /auth/google.
2) لو الإيميل عندنا ومقبول: بنرجّع توكن دخول. لو لسه مستني موافقة أو مرفوض: بنرجّع حالته.
3) لو الإيميل جديد: بنرجّع registration_token قصير، والمستخدم يختار دوره (طالب/ولي أمر/معلم).
4) /auth/google/register بيعمل حساب بحالة "pending". الدخول مقفول لحد ما المالك أو المدير يوافق.
"""
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import client_ip
from app.core.i18n import localize
from app.core.security import (
    create_access_token, create_registration_token, decode_registration_token, hash_password,
)
from app.db.session import get_db
from app.models.academic import Grade
from app.models.audit import AuditLog
from app.models.mixins import utcnow
from app.models.student import StudentProfile
from app.models.user import Role, User
from app.schemas.registration import (
    GoogleLoginIn, GoogleLoginOut, GoogleRegisterIn, GoogleRegisterOut, GradeOption, PublicConfig,
)
from app.services import audit
from app.services.google_auth import verify_google_credential

router = APIRouter(prefix="/auth", tags=["auth-google"])

PENDING_MESSAGE = "طلب تسجيلك وصل لإدارة الأكاديمية وقيد المراجعة. هتقدر تدخل أول ما تتم الموافقة عليه."


@router.get("/public-config", response_model=PublicConfig)
def public_config(db: Session = Depends(get_db)):
    grades = db.scalars(
        select(Grade).where(Grade.is_active.is_(True)).order_by(Grade.order_index, Grade.id)
    ).all()
    return PublicConfig(
        google_client_id=get_settings().GOOGLE_CLIENT_ID or None,
        grades=[GradeOption(id=g.id, name=g.name) for g in grades],
    )


@router.post("/google", response_model=GoogleLoginOut)
def google_login(data: GoogleLoginIn, request: Request, db: Session = Depends(get_db)):
    info = verify_google_credential(data.credential)
    ip = client_ip(request)

    user = db.scalar(select(User).where(or_(User.google_sub == info["sub"], User.email == info["email"])))

    if user is None:
        token = create_registration_token(google_sub=info["sub"], email=info["email"], name=info["name"])
        return GoogleLoginOut(status="needs_registration", registration_token=token,
                              email=info["email"], name=info["name"])

    if user.google_sub and user.google_sub != info["sub"]:
        raise HTTPException(401, "هذا البريد مرتبط بحساب جوجل آخر.")
    if user.role == Role.super_admin:
        raise HTTPException(403, "حساب المالك يدخل بالبريد وكلمة المرور فقط.")
    if user.approval_status == "pending":
        return GoogleLoginOut(status="pending", message=localize(request, PENDING_MESSAGE))
    if user.approval_status == "rejected":
        reason = f" السبب: {user.rejection_reason}" if user.rejection_reason else ""
        return GoogleLoginOut(
            status="rejected",
            message=localize(request, f"للأسف لم تتم الموافقة على طلب تسجيلك.{reason} تواصل مع إدارة الأكاديمية."),
        )
    if not user.is_active:
        raise HTTPException(403, "هذا الحساب موقوف. تواصل مع إدارة الأكاديمية.")

    if user.google_sub is None:
        user.google_sub = info["sub"]  # ربط حساب أنشأته الإدارة بجوجل (بإيميل مؤكد)
    user.last_login_at = utcnow()
    audit.log_action(db, actor_id=user.id, action=audit.GOOGLE_LOGIN, ip=ip)
    db.commit()
    db.refresh(user)
    return GoogleLoginOut(
        status="ok", access_token=create_access_token(user.id, user.token_version), user=user
    )


@router.post("/google/register", response_model=GoogleRegisterOut, status_code=201)
def google_register(data: GoogleRegisterIn, request: Request, db: Session = Depends(get_db)):
    claims = decode_registration_token(data.registration_token)
    if claims is None:
        raise HTTPException(401, "انتهت صلاحية خطوة التسجيل. سجّل الدخول بجوجل من جديد.")

    s = get_settings()
    ip = client_ip(request)
    if ip:
        recent = db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == audit.REGISTRATION_REQUESTED,
                AuditLog.ip_address == ip,
                AuditLog.created_at > utcnow() - timedelta(hours=1),
            )
        ) or 0
        if recent >= s.MAX_REGISTRATIONS_PER_IP:
            raise HTTPException(429, "طلبات تسجيل كتيرة من هذا الجهاز. حاول بعد قليل.")

    email, sub = claims["email"], claims["sub"]
    if db.scalar(select(User.id).where(or_(User.email == email, User.google_sub == sub))):
        raise HTTPException(409, "هذا الحساب مسجل بالفعل. سجّل الدخول بجوجل.")

    role = Role(data.role)
    # أدوار التفعيل الفوري (من الإعدادات). المعلم والمدير مستثنيين دايماً.
    auto_roles = {r.strip() for r in s.AUTO_APPROVE_ROLES.split(",") if r.strip()} - {"teacher", "admin", "super_admin"}
    auto = role.value in auto_roles
    if role == Role.student:
        grade = db.get(Grade, data.grade_id) if data.grade_id else None
        if grade is None or not grade.is_active:
            raise HTTPException(422, "اختر الصف الدراسي.")

    user = User(
        full_name=data.full_name,
        email=email,
        # كلمة سر عشوائية غير معروفة: الحساب ده بيدخل بجوجل بس (والإدارة تقدر تعمله باسورد مؤقت)
        password_hash=hash_password(secrets.token_urlsafe(32)),
        role=role,
        approval_status="approved" if auto else "pending",
        google_sub=sub,
        registration_note=data.note,
        must_change_password=False,
        last_login_at=utcnow() if auto else None,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "هذا الحساب مسجل بالفعل. سجّل الدخول بجوجل.")

    if role == Role.student:
        db.add(StudentProfile(student_id=user.id, grade_id=data.grade_id))
    audit.log_action(db, actor_id=user.id, action=audit.REGISTRATION_REQUESTED,
                     target_type="user", target_id=user.id, detail=f"role={role.value} auto={auto}", ip=ip)
    db.commit()
    if auto:
        db.refresh(user)
        return GoogleRegisterOut(
            status="ok", message=localize(request, "تم إنشاء حسابك بنجاح."),
            access_token=create_access_token(user.id, user.token_version), user=user,
        )
    return GoogleRegisterOut(message=localize(request, PENDING_MESSAGE))
