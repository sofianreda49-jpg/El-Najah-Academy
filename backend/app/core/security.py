from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()
# hash وهمي: بنتحقق منه لما الإيميل مش موجود، علشان زمن الرد ما يكشفش وجود الحساب
DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int, token_version: int) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "tv": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=s.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def _decode(token: str) -> dict | None:
    s = get_settings()
    try:
        return jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def decode_access_token(token: str) -> dict | None:
    payload = _decode(token)
    # توكن التسجيل المؤقت (typ=reg) مش بيتقبل كتوكن دخول أبداً
    if payload is None or payload.get("typ") is not None:
        return None
    return payload


def create_registration_token(*, google_sub: str, email: str, name: str) -> str:
    """توكن قصير (15 دقيقة) بيثبت إن جوجل أكد الإيميل، بيتستخدم لإكمال التسجيل بس."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "typ": "reg", "sub": google_sub, "email": email, "name": name,
        "iat": now, "exp": now + timedelta(minutes=15),
    }
    return jwt.encode(payload, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def decode_registration_token(token: str) -> dict | None:
    payload = _decode(token)
    if payload is None or payload.get("typ") != "reg":
        return None
    return payload
