"""بيانات الحساب الشخصي للمستخدم الحالي."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_verified_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import FullName, UserOut
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["profile"])


class ProfileUpdate(BaseModel):
    full_name: FullName


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_verified_user)):
    """المستخدم يعدّل اسمه بس. البريد والدور من صلاحيات الإدارة."""
    user.full_name = data.full_name
    db.commit()
    db.refresh(user)
    return user
