"""لغة الرد: الواجهة بتبعت Accept-Language، والباك إند بيترجم رسائل الأخطاء للإنجليزي لو مطلوب."""
import re

from fastapi import Request

from app.core.messages_en import EXACT, PATTERNS

_COMPILED = [(re.compile(rx, re.DOTALL), template) for rx, template in PATTERNS]


def request_lang(request: Request) -> str:
    header = (request.headers.get("accept-language") or "").strip().lower()
    return "en" if header.startswith("en") else "ar"


def translate(text, lang: str, _depth: int = 0):
    """بيرجّع نفس النص لو مفيش ترجمة (فالمستخدم عمره ما بيشوف رسالة فاضية)."""
    if lang != "en" or not isinstance(text, str):
        return text
    hit = EXACT.get(text)
    if hit is not None:
        return hit
    for rx, template in _COMPILED:
        m = rx.match(text)
        if m:
            groups = [translate(g, lang, _depth + 1) if _depth < 2 else g for g in m.groups()]
            return template.format(*groups)
    return text


def localize(request: Request, text):
    return translate(text, request_lang(request))
