from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import Role, User

_bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="الجلسة غير صالحة. سجّل الدخول من جديد.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """المستخدم الحالي (يسمح حتى لو لازم يغيّر كلمة المرور)."""
    if creds is None:
        raise _unauthorized()
    payload = decode_access_token(creds.credentials)
    if not payload:
        raise _unauthorized()
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise _unauthorized()

    user = db.get(User, user_id)
    if (
        user is None
        or not user.is_active
        or user.approval_status != "approved"  # الحسابات اللي لسه مستنية موافقة ماتدخلش
        or payload.get("tv") != user.token_version
    ):
        raise _unauthorized()
    return user


def get_verified_user(user: User = Depends(get_current_user)) -> User:
    """نفس السابق، لكن يمنع الحساب اللي لسه بكلمة مرور مؤقتة."""
    if user.must_change_password:
        raise HTTPException(403, "يجب تغيير كلمة المرور المؤقتة أولاً.")
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(get_verified_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "ليس لديك صلاحية لتنفيذ هذا الإجراء.")
        return user

    return checker


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
