from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import client_ip, get_current_user
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.mixins import utcnow
from app.models.user import User
from app.schemas.auth import ChangePasswordIn, LoginIn, TokenOut
from app.schemas.user import UserOut
from app.services import audit
from app.services.users import normalize_email

router = APIRouter(prefix="/auth", tags=["auth"])

BAD_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة."


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    s = get_settings()
    ip = client_ip(request)
    now = utcnow()
    email = normalize_email(data.email)
    user = db.scalar(select(User).where(User.email == email))

    # حد محاولات الدخول الفاشلة من نفس الـ IP (بيحمي من تجربة إيميلات كتير)
    if ip:
        recent = db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == audit.LOGIN_FAILED,
                AuditLog.ip_address == ip,
                AuditLog.created_at > now - timedelta(minutes=10),
            )
        ) or 0
        if recent >= s.MAX_FAILED_PER_IP:
            raise HTTPException(429, "محاولات دخول كثيرة من هذا الجهاز. حاول مرة أخرى بعد قليل.")

    # الحساب مقفول مؤقتاً بعد محاولات فاشلة كتير
    if user and user.locked_until and user.locked_until > now:
        minutes = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(429, f"محاولات كثيرة. حاول مرة أخرى بعد {minutes} دقيقة.")

    if user:
        ok = verify_password(data.password, user.password_hash)
    else:
        verify_password(data.password, DUMMY_HASH)  # نفس زمن الرد
        ok = False

    if not user or not ok:
        if user:
            user.failed_login_count += 1
            audit.log_action(db, actor_id=user.id, action=audit.LOGIN_FAILED, ip=ip)
            if user.failed_login_count >= s.MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(minutes=s.LOCKOUT_MINUTES)
                user.failed_login_count = 0
                audit.log_action(db, actor_id=user.id, action=audit.ACCOUNT_LOCKED, ip=ip)
            db.commit()
        else:
            # إيميل مش موجود: نسجّلها من غير ما نكشف ده للمستخدم (علشان حد الـ IP يشتغل)
            audit.log_action(db, actor_id=None, action=audit.LOGIN_FAILED, ip=ip, detail="unknown_email")
            db.commit()
        raise HTTPException(401, BAD_CREDENTIALS)

    if not user.is_active:
        raise HTTPException(403, "هذا الحساب موقوف. تواصل مع إدارة الأكاديمية.")
    if user.approval_status != "approved":
        raise HTTPException(403, "حسابك قيد المراجعة من إدارة الأكاديمية.")

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    audit.log_action(db, actor_id=user.id, action=audit.LOGIN, ip=ip)
    db.commit()
    db.refresh(user)

    return TokenOut(
        access_token=create_access_token(user.id, user.token_version), user=user
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=TokenOut)
def change_password(
    data: ChangePasswordIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "كلمة المرور الحالية غير صحيحة.")
    if data.new_password == data.current_password:
        raise HTTPException(400, "كلمة المرور الجديدة لازم تختلف عن الحالية.")

    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.token_version += 1  # يبطل كل الجلسات القديمة
    audit.log_action(
        db, actor_id=user.id, action=audit.PASSWORD_CHANGED,
        target_type="user", target_id=user.id, ip=client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return TokenOut(
        access_token=create_access_token(user.id, user.token_version), user=user
    )
