from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # فولدر backend


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    APP_NAME: str = "El Najah Academy"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str  # مطلوب: لا قيمة افتراضية، علشان ما نشتغلش على داتابيز غلط بالصدفة
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:5173"
    MAX_FAILED_LOGINS: int = 5
    LOCKOUT_MINUTES: int = 15
    # حد محاولات الدخول الفاشلة من نفس الـ IP خلال 10 دقايق (طبقة إضافية فوق قفل الحساب)
    MAX_FAILED_PER_IP: int = 30
    # تسجيل الدخول بجوجل (Client ID مش سري). لو فاضي، الزر مبيظهرش.
    GOOGLE_CLIENT_ID: str = ""
    # حد طلبات التسجيل الجديدة من نفس الـ IP في الساعة (بيمنع إغراق طابور الموافقات)
    MAX_REGISTRATIONS_PER_IP: int = 10
    # أدوار بتتفعّل فوراً بعد التسجيل بجوجل من غير موافقة (مثلاً: student,parent).
    # المعلم والمدير ما بيتفعّلوش تلقائياً أبداً حتى لو اتكتبوا هنا.
    AUTO_APPROVE_ROLES: str = ""
    # اتصالات الداتابيز (Supabase المجاني عنده حد صغير للاتصالات)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5

    @field_validator("JWT_SECRET")
    @classmethod
    def _strong_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET لازم يكون 32 حرف على الأقل")
        return v

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
