from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.academic import Grade
from app.models.student import StudentProfile
from app.models.user import Role, User
from app.services import audit

# مين يقدر ينشئ ويدير مين. المالك (super_admin) لا يُنشأ ولا يُعدَّل من الـ API نهائياً.
MANAGEABLE: dict[Role, set[Role]] = {
    Role.super_admin: {Role.admin, Role.teacher, Role.student, Role.parent},
    Role.admin: {Role.teacher, Role.student, Role.parent},
}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def can_manage(actor: User, target: User) -> bool:
    return target.id != actor.id and target.role in MANAGEABLE.get(actor.role, set())


def _active_grade(db: Session, grade_id: int) -> Grade:
    grade = db.get(Grade, grade_id)
    if grade is None or not grade.is_active:
        raise HTTPException(404, "الصف غير موجود.")
    return grade


def set_student_grade(db: Session, student: User, grade_id: int) -> None:
    """يحدد (أو يغيّر) صف الطالب. الـ commit مسؤولية اللي بينادي."""
    _active_grade(db, grade_id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student.id))
    if profile:
        profile.grade_id = grade_id
    else:
        db.add(StudentProfile(student_id=student.id, grade_id=grade_id))


def create_user(
    db: Session, actor: User, *, full_name: str, email: str, password: str,
    role: Role, ip: str | None, grade_id: int | None = None,
) -> User:
    if role not in MANAGEABLE.get(actor.role, set()):
        raise HTTPException(403, "لا يمكنك إنشاء حساب بهذا الدور.")

    if role == Role.student:
        if grade_id is None:
            raise HTTPException(400, "اختر الصف الدراسي للطالب.")
        _active_grade(db, grade_id)

    email = normalize_email(email)
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "هذا البريد الإلكتروني مسجل بالفعل.")

    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        must_change_password=True,  # الباسورد مؤقت: المستخدم يغيّره أول دخول
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "هذا البريد الإلكتروني مسجل بالفعل.")

    if role == Role.student:
        db.add(StudentProfile(student_id=user.id, grade_id=grade_id))

    audit.log_action(
        db, actor_id=actor.id, action=audit.USER_CREATED,
        target_type="user", target_id=user.id, detail=f"role={role.value}", ip=ip,
    )
    db.commit()
    db.refresh(user)
    return user
