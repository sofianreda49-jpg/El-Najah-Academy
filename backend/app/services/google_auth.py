"""التحقق من ID Token بتاع جوجل (تسجيل الدخول بحساب جوجل).

بنتحقق من: التوقيع (مفاتيح جوجل العامة)، والـ audience (لازم يكون Client ID بتاعنا)،
والمُصدِر، وانتهاء الصلاحية، وإن الإيميل مؤكد عند جوجل. مفيش أسرار على الواجهة.
"""
import logging

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
_jwk_client = PyJWKClient(_CERTS_URL, cache_keys=True, lifespan=3600)


def google_enabled() -> bool:
    return bool(get_settings().GOOGLE_CLIENT_ID)


def verify_google_credential(credential: str) -> dict:
    client_id = get_settings().GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(503, "تسجيل الدخول بحساب جوجل غير مفعّل حالياً.")
    try:
        key = _jwk_client.get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential, key, algorithms=["RS256"], audience=client_id, leeway=10,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.PyJWTError as exc:
        # السبب الحقيقي بيظهر في الـ Terminal بتاع الباك إند (مش للمستخدم)
        logger.warning("Google token verification failed: %s: %s", type(exc).__name__, exc)
        raise HTTPException(401, "تعذر التحقق من حساب جوجل. حاول مرة أخرى.")

    if claims.get("iss") not in _ISSUERS:
        raise HTTPException(401, "تعذر التحقق من حساب جوجل.")
    email = (claims.get("email") or "").strip().lower()
    if not email or not claims.get("email_verified"):
        raise HTTPException(401, "بريد جوجل غير مؤكد. استخدم حساباً مؤكداً.")

    return {
        "sub": str(claims["sub"]),
        "email": email,
        "name": (claims.get("name") or email.split("@")[0]).strip()[:150],
    }
