"""واجهة الطالب: كورسات صفه المنشورة، الدروس، وتعليم الدرس كمكتمل.

كل مسار بيتأكد إن الكورس منشور ونشط وتابع لصف الطالب نفسه، فالطالب
مايقدرش يفتح محتوى صف تاني ولا مسودات بالتخمين في الأرقام.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import AcademicYear, Course, Grade, Lesson, Subject, Term, Unit
from app.models.progress import LessonProgress
from app.models.student import StudentProfile
from app.models.user import Role, User
from app.services import visibility
from app.schemas.student import (
    CourseCard, CourseRef, CourseView, GradeRef, LessonItem, LessonView,
    StudentHome, UnitItem,
)

router = APIRouter(prefix="/student", tags=["student"])
student_only = require_roles(Role.student)

NO_GRADE = "لم يتم تحديد صفك الدراسي بعد. تواصل مع إدارة الأكاديمية."


def _profile(db: Session, user: User) -> StudentProfile | None:
    return db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))


def _lesson_counts(db: Session, course_ids: list[int], student_id: int):
    """يرجّع (إجمالي الدروس، المكتمل) لكل كورس. الدروس المنشورة والنشطة بس."""
    if not course_ids:
        return {}, {}
    filters = [
        Unit.course_id.in_(course_ids),
        Unit.is_active.is_(True),
        Lesson.is_active.is_(True),
        Lesson.is_published.is_(True),
    ]
    totals = dict(
        db.execute(
            select(Unit.course_id, func.count(Lesson.id))
            .join(Lesson, Lesson.unit_id == Unit.id)
            .where(*filters)
            .group_by(Unit.course_id)
        ).all()
    )
    done = dict(
        db.execute(
            select(Unit.course_id, func.count(Lesson.id))
            .join(Lesson, Lesson.unit_id == Unit.id)
            .join(
                LessonProgress,
                and_(LessonProgress.lesson_id == Lesson.id, LessonProgress.student_id == student_id),
            )
            .where(*filters)
            .group_by(Unit.course_id)
        ).all()
    )
    return totals, done


def _accessible_course(db: Session, user: User, course_id: int) -> Course:
    profile = _profile(db, user)
    if profile is None:
        raise HTTPException(409, NO_GRADE)
    course = db.get(Course, course_id)
    if (
        course is None
        or not course.is_active
        or not course.is_published
        or not visibility.student_can_access(db, user.id, profile.grade_id, course)
    ):
        raise HTTPException(404, "الكورس غير موجود.")
    return course


def _course_lessons(db: Session, course: Course):
    """الوحدات والدروس المنشورة بترتيبها الصحيح."""
    units = db.scalars(
        select(Unit)
        .where(Unit.course_id == course.id, Unit.is_active.is_(True))
        .order_by(Unit.order_index, Unit.id)
    ).all()
    by_unit: dict[int, list[Lesson]] = {u.id: [] for u in units}
    if units:
        lessons = db.scalars(
            select(Lesson)
            .where(
                Lesson.unit_id.in_([u.id for u in units]),
                Lesson.is_active.is_(True),
                Lesson.is_published.is_(True),
            )
            .order_by(Lesson.order_index, Lesson.id)
        ).all()
        for lesson in lessons:
            by_unit[lesson.unit_id].append(lesson)
    return units, by_unit


def _completed_ids(db: Session, student_id: int, lesson_ids: list[int]) -> set[int]:
    if not lesson_ids:
        return set()
    return set(
        db.scalars(
            select(LessonProgress.lesson_id).where(
                LessonProgress.student_id == student_id,
                LessonProgress.lesson_id.in_(lesson_ids),
            )
        ).all()
    )


# =========================================================
# الرئيسية
# =========================================================

@router.get("/home", response_model=StudentHome)
def home(db: Session = Depends(get_db), user: User = Depends(student_only)):
    profile = _profile(db, user)
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
                visibility.visible_course_clause(user.id, profile.grade_id),
                Course.is_active.is_(True),
                Course.is_published.is_(True),
                Subject.is_active.is_(True),
                Course.term_id.in_(term_ids),
            )
            .order_by(Term.order_index, Subject.order_index, Course.order_index, Course.id)
        ).all()

    totals, done = _lesson_counts(db, [c.id for c, _, _ in rows], user.id)
    cards = [
        CourseCard(
            id=c.id, name=c.name, description=c.description,
            subject_name=subject_name, term_name=term_name,
            total_lessons=totals.get(c.id, 0), completed_lessons=done.get(c.id, 0),
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


# =========================================================
# الكورس
# =========================================================

@router.get("/courses/{course_id}", response_model=CourseView)
def course_view(course_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    course = _accessible_course(db, user, course_id)
    subject = db.get(Subject, course.subject_id)
    term = db.get(Term, course.term_id)

    units, by_unit = _course_lessons(db, course)
    all_ids = [lesson.id for u in units for lesson in by_unit[u.id]]
    completed = _completed_ids(db, user.id, all_ids)

    unit_items = [
        UnitItem(
            id=u.id, name=u.name, description=u.description,
            lessons=[
                LessonItem(
                    id=lesson.id, title=lesson.title,
                    has_video=bool(lesson.video_url), has_file=bool(lesson.file_url),
                    is_completed=lesson.id in completed,
                )
                for lesson in by_unit[u.id]
            ],
        )
        for u in units
        if by_unit[u.id]  # نخفي الوحدات اللي مفيهاش دروس منشورة
    ]
    next_lesson = next((i for i in all_ids if i not in completed), None)

    return CourseView(
        id=course.id, name=course.name, description=course.description,
        subject_name=subject.name if subject else "", term_name=term.name if term else "",
        total_lessons=len(all_ids), completed_lessons=len(completed),
        next_lesson_id=next_lesson, units=unit_items,
    )


# =========================================================
# الدرس
# =========================================================

def _lesson_for_student(db: Session, user: User, lesson_id: int):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None or not lesson.is_active or not lesson.is_published:
        raise HTTPException(404, "الدرس غير موجود.")
    unit = db.get(Unit, lesson.unit_id)
    if unit is None or not unit.is_active:
        raise HTTPException(404, "الدرس غير موجود.")
    course = _accessible_course(db, user, unit.course_id)
    return lesson, unit, course


@router.get("/lessons/{lesson_id}", response_model=LessonView)
def lesson_view(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    lesson, unit, course = _lesson_for_student(db, user, lesson_id)

    units, by_unit = _course_lessons(db, course)
    ordered = [x.id for u in units for x in by_unit[u.id]]
    position = ordered.index(lesson.id)
    completed = lesson.id in _completed_ids(db, user.id, [lesson.id])

    return LessonView(
        id=lesson.id, title=lesson.title, content=lesson.content,
        video_url=lesson.video_url, file_url=lesson.file_url,
        unit_name=unit.name, course=CourseRef(id=course.id, name=course.name),
        is_completed=completed,
        prev_id=ordered[position - 1] if position > 0 else None,
        next_id=ordered[position + 1] if position < len(ordered) - 1 else None,
        position=position + 1, total=len(ordered),
    )


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    lesson, _, _ = _lesson_for_student(db, user, lesson_id)
    exists = db.scalar(
        select(LessonProgress.id).where(
            LessonProgress.student_id == user.id, LessonProgress.lesson_id == lesson.id
        )
    )
    if not exists:
        db.add(LessonProgress(student_id=user.id, lesson_id=lesson.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # ضغطة مزدوجة: السطر موجود فعلاً، مفيش مشكلة
    return {"is_completed": True}


@router.delete("/lessons/{lesson_id}/complete")
def uncomplete_lesson(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    lesson, _, _ = _lesson_for_student(db, user, lesson_id)
    row = db.scalar(
        select(LessonProgress).where(
            LessonProgress.student_id == user.id, LessonProgress.lesson_id == lesson.id
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return {"is_completed": False}
