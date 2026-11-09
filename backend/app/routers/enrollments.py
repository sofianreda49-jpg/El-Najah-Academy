"""إضافة طلاب على كورس (المعلم في كورساته، والمالك والمدير في أي كورس).

الإضافة بالبريد الإلكتروني بالظبط، علشان المعلم ما يتصفحش كل طلاب الأكاديمية.
الطالب لازم يكون له حساب مقبول.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.core.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.academic import Course, Grade
from app.models.enrollment import course_enrollment
from app.models.user import Role, User
from app.schemas.academy import MessageOut
from app.schemas.registration import AddStudentIn, EnrolledStudent
from app.services import academy as svc
from app.services import access, audit

router = APIRouter(prefix="/academy/courses/{course_id}/students", tags=["enrollments"])
editor = require_roles(Role.super_admin, Role.admin, Role.teacher)


def _course(db: Session, actor: User, course_id: int) -> Course:
    access.ensure_course_access(db, actor, course_id)
    return svc.get_active(db, Course, course_id, "الكورس غير موجود")


def _out(db: Session, u: User) -> EnrolledStudent:
    grade = db.get(Grade, u.grade_id) if u.grade_id else None
    return EnrolledStudent(id=u.id, full_name=u.full_name, email=u.email, grade_name=grade.name if grade else None)


@router.get("", response_model=list[EnrolledStudent])
def list_enrolled(course_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    course = _course(db, actor, course_id)
    students = db.scalars(
        select(User)
        .join(course_enrollment, course_enrollment.c.student_id == User.id)
        .where(course_enrollment.c.course_id == course.id)
        .order_by(User.full_name)
    ).all()
    return [_out(db, s) for s in students]


@router.post("", response_model=EnrolledStudent, status_code=201)
def add_student(course_id: int, data: AddStudentIn, request: Request,
                db: Session = Depends(get_db), actor: User = Depends(editor)):
    course = _course(db, actor, course_id)
    email = data.email.strip().lower()
    student = db.scalar(
        select(User).where(
            User.email == email, User.role == Role.student,
            User.is_active.is_(True), User.approval_status == "approved",
        )
    )
    if student is None:
        raise HTTPException(
            404, "لا يوجد طالب بهذا البريد. تأكد إنه سجّل حسابه وتمت الموافقة عليه.")

    exists = db.execute(
        select(course_enrollment.c.course_id).where(
            course_enrollment.c.course_id == course.id, course_enrollment.c.student_id == student.id
        )
    ).first()
    if exists:
        raise HTTPException(409, "هذا الطالب مضاف على الكورس بالفعل.")

    db.execute(insert(course_enrollment).values(
        course_id=course.id, student_id=student.id, added_by=actor.id))
    audit.log_action(db, actor_id=actor.id, action=audit.ENROLLMENT_ADDED, target_type="course",
                     target_id=course.id, detail=f"student={student.id}", ip=client_ip(request))
    db.commit()
    return _out(db, student)


@router.delete("/{student_id}", response_model=MessageOut)
def remove_student(course_id: int, student_id: int, request: Request,
                   db: Session = Depends(get_db), actor: User = Depends(editor)):
    course = _course(db, actor, course_id)
    result = db.execute(delete(course_enrollment).where(
        course_enrollment.c.course_id == course.id, course_enrollment.c.student_id == student_id))
    if result.rowcount == 0:
        raise HTTPException(404, "هذا الطالب غير مضاف على الكورس.")
    audit.log_action(db, actor_id=actor.id, action=audit.ENROLLMENT_REMOVED, target_type="course",
                     target_id=course.id, detail=f"student={student_id}", ip=client_ip(request))
    db.commit()
    return {"message": "تم إزالة الطالب من الكورس"}
