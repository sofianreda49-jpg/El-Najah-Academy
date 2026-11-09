"""لوحة ولي الأمر: متابعة الأبناء المربوطين بحسابه فقط (قراءة فقط).

كل مسار بيتأكد إن الطالب مربوط فعلاً بولي الأمر ده، فمايقدرش يشوف
بيانات طالب تاني بتغيير الرقم في الرابط.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import AcademicYear, Course, Grade, Subject, Term
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt
from app.models.family import parent_student
from app.models.user import Role, User
from app.routers.student import _lesson_counts, _profile
from app.schemas.assessment import ResultRow
from app.schemas.family import ChildDetail, ChildSummary
from app.schemas.student import CourseCard, GradeRef, StudentHome
from app.services import visibility

router = APIRouter(prefix="/parent", tags=["parent"])
parent_only = require_roles(Role.parent)


def _linked_students(db: Session, parent: User) -> list[User]:
    return list(db.scalars(
        select(User)
        .join(parent_student, parent_student.c.student_id == User.id)
        .where(parent_student.c.parent_id == parent.id, User.role == Role.student)
        .order_by(User.full_name)
    ).all())


def _own_child(db: Session, parent: User, student_id: int) -> User:
    linked = db.execute(
        select(parent_student.c.student_id).where(
            parent_student.c.parent_id == parent.id, parent_student.c.student_id == student_id
        )
    ).first()
    student = db.get(User, student_id) if linked else None
    if student is None or student.role != Role.student:
        raise HTTPException(404, "الطالب غير موجود.")
    return student


def _overview(db: Session, student: User) -> StudentHome:
    """نفس ملخص لوحة الطالب، لكن محسوب لطالب معيّن."""
    profile = _profile(db, student)
    if profile is None:
        return StudentHome(grade=None, year=None, courses=[], total_lessons=0, completed_lessons=0)

    grade = db.get(Grade, profile.grade_id)
    year = db.scalar(
        select(AcademicYear).where(AcademicYear.is_current.is_(True), AcademicYear.is_active.is_(True))
    )

    rows = []
    if year:
        term_ids = db.scalars(
            select(Term.id).where(Term.academic_year_id == year.id, Term.is_active.is_(True))
        ).all()
        rows = db.execute(
            select(Course, Subject.name, Term.name)
            .join(Subject, Subject.id == Course.subject_id)
            .join(Term, Term.id == Course.term_id)
            .where(
                visibility.visible_course_clause(student.id, profile.grade_id),
                Course.is_active.is_(True),
                Course.is_published.is_(True),
                Subject.is_active.is_(True),
                Course.term_id.in_(term_ids),
            )
            .order_by(Term.order_index, Subject.order_index, Course.order_index, Course.id)
        ).all()

    totals, done = _lesson_counts(db, [c.id for c, _, _ in rows], student.id)
    cards = [
        CourseCard(
            id=c.id, name=c.name, description=c.description, subject_name=subject_name,
            term_name=term_name, total_lessons=totals.get(c.id, 0), completed_lessons=done.get(c.id, 0),
        )
        for c, subject_name, term_name in rows
    ]
    return StudentHome(
        grade=GradeRef(id=grade.id, name=grade.name) if grade else None,
        year=year.name if year else None,
        courses=cards,
        total_lessons=sum(c.total_lessons for c in cards),
        completed_lessons=sum(c.completed_lessons for c in cards),
    )


@router.get("/children", response_model=list[ChildSummary])
def children(db: Session = Depends(get_db), parent: User = Depends(parent_only)):
    out = []
    for s in _linked_students(db, parent):
        overview = _overview(db, s)
        attempts, avg = db.execute(
            select(func.count(AssessmentAttempt.id), func.avg(AssessmentAttempt.percentage))
            .where(AssessmentAttempt.student_id == s.id, AssessmentAttempt.status != IN_PROGRESS)
        ).one()
        out.append(ChildSummary(
            id=s.id, full_name=s.full_name,
            grade_name=overview.grade.name if overview.grade else None,
            total_lessons=overview.total_lessons, completed_lessons=overview.completed_lessons,
            attempts_count=attempts, average_percentage=round(float(avg), 1) if avg is not None else None,
        ))
    return out


@router.get("/children/{student_id}", response_model=ChildDetail)
def child_detail(student_id: int, db: Session = Depends(get_db), parent: User = Depends(parent_only)):
    student = _own_child(db, parent, student_id)
    rows = db.execute(
        select(AssessmentAttempt, Assessment.title, Course.name)
        .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
        .join(Course, Course.id == Assessment.course_id)
        .where(AssessmentAttempt.student_id == student.id, AssessmentAttempt.status != IN_PROGRESS)
        .order_by(AssessmentAttempt.id.desc())
        .limit(100)
    ).all()
    results = [
        ResultRow(
            attempt_id=at.id, assessment_id=at.assessment_id, assessment_title=title,
            course_name=course_name, attempt_number=at.attempt_number, status=at.status,
            score=at.score, max_score=at.max_score, percentage=at.percentage,
            is_passed=at.is_passed, submitted_at=at.submitted_at,
        )
        for at, title, course_name in rows
    ]
    return ChildDetail(id=student.id, full_name=student.full_name,
                       overview=_overview(db, student), results=results)
