from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

_settings = get_settings()

if _settings.DB_NULL_POOL:
    # Serverless + Supabase/Neon pooler (بورت 6543): كل طلب بياخد اتصال ويقفله، والـ pooler بيجمّعهم
    engine = create_engine(_settings.DATABASE_URL, poolclass=NullPool)
else:
    engine = create_engine(
        _settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=_settings.DB_POOL_SIZE,
        max_overflow=_settings.DB_MAX_OVERFLOW,
        pool_recycle=1800,  # بنجدد الاتصالات القديمة علشان السيرفر ما يقفلهاش علينا
    )
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
