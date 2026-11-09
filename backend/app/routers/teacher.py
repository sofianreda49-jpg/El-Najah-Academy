"""لوحة المعلم: كورساته المعيّنة، طلاب كل كورس وتقدمهم، ونتايج اختباراته (قراءة فقط).

المعلم مايشوفش غير الكورسات المعيّنة عليه، وكل مسار بيتأكد من التعيين.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course, Grade, Lesson, Subject, Term, Unit
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt, Question
from app.models.progress import LessonProgress
from app.models.student import StudentProfile
from app.models.teaching import teacher_course
from app.models.user import Role, User
from app.routers.assessments import assessment_results
from app.schemas.assessment import AttemptPage
from app.services import visibility
from app.schemas.teaching import (
    TeacherAssessmentRow, TeacherCourseCard, TeacherCourseDetail, TeacherStudentRow,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])
teacher_only = require_roles(Role.teacher)


def _assigned_course(db: Session, teacher: User, course_id: int) -> Course:
    linked = db.execute(
        select(teacher_course.c.course_id).where(
            teacher_course.c.teacher_id == teacher.id, teacher_course.c.course_id == course_id
        )
    ).first()
    course = db.get(Course, course_id) if linked else None
    if course is None or not course.is_active:
        raise HTTPException(404, "الكورس غير موجود.")
    return course


def _students_of_grade(db: Session, grade_id: int) -> list[User]:
    return list(db.scalars(
        select(User)
        .join(StudentProfile, StudentProfile.student_id == User.id)
        .where(StudentProfile.grade_id == grade_id, User.is_active.is_(True), User.role == Role.student)
        .order_by(User.full_name)
    ).all())


def _published_lessons(db: Session, course_id: int) -> int:
    return db.scalar(
        select(func.count(Lesson.id))
        .select_from(Lesson)
        .join(Unit, Unit.id == Lesson.unit_id)
        .where(Unit.course_id == course_id, Unit.is_active.is_(True),
               Lesson.is_active.is_(True), Lesson.is_published.is_(True))
    ) or 0


def _course_names(db: Session, course: Course) -> tuple[str, str, str]:
    subject = db.get(Subject, course.subject_id)
    grade = db.get(Grade, course.grade_id)
    term = db.get(Term, course.term_id)
    return (subject.name if subject else "", grade.name if grade else "", term.name if term else "")


@router.get("/courses", response_model=list[TeacherCourseCard])
def my_courses(db: Session = Depends(get_db), teacher: User = Depends(teacher_only)):
    rows = db.execute(
        select(Course)
        .join(teacher_course, teacher_course.c.course_id == Course.id)
        .join(Grade, Grade.id == Course.grade_id)
        .join(Term, Term.id == Course.term_id)
        .join(Subject, Subject.id == Course.subject_id)
        .where(teacher_course.c.teacher_id == teacher.id, Course.is_active.is_(True))
        .order_by(Grade.order_index, Term.order_index, Subject.order_index, Course.id)
    ).scalars().all()

    cards = []
    for c in rows:
        subject_name, grade_name, term_name = _course_names(db, c)
        student_count = len(visibility.students_of_course(db, c))
        assessments_count = db.scalar(
            select(func.count(Assessment.id)).where(Assessment.course_id == c.id, Assessment.is_active.is_(True))
        ) or 0
        avg = db.scalar(
            select(func.avg(AssessmentAttempt.percentage))
            .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
            .where(Assessment.course_id == c.id, AssessmentAttempt.status != IN_PROGRESS)
        )
        cards.append(TeacherCourseCard(
            id=c.id, name=c.name, subject_name=subject_name, grade_name=grade_name, term_name=term_name,
            student_count=student_count, total_lessons=_published_lessons(db, c.id),
            assessments_count=assessments_count,
            average_percentage=round(float(avg), 1) if avg is not None else None,
        ))
    return cards


@router.get("/courses/{course_id}", response_model=TeacherCourseDetail)
def course_detail(course_id: int, db: Session = Depends(get_db), teacher: User = Depends(teacher_only)):
    course = _assigned_course(db, teacher, course_id)
    subject_name, grade_name, term_name = _course_names(db, course)
    total_lessons = _published_lessons(db, course.id)

    students = visibility.students_of_course(db, course)
    student_ids = [s.id for s in students]

    done: dict[int, int] = {}
    attempts: dict[int, tuple[int, float | None]] = {}
    if student_ids:
        done = dict(db.execute(
            select(LessonProgress.student_id, func.count(LessonProgress.id))
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .join(Unit, Unit.id == Lesson.unit_id)
            .where(Unit.course_id == course.id, Unit.is_active.is_(True), Lesson.is_active.is_(True),
                   Lesson.is_published.is_(True), LessonProgress.student_id.in_(student_ids))
            .group_by(LessonProgress.student_id)
        ).all())
        for sid, cnt, avg in db.execute(
            select(AssessmentAttempt.student_id, func.count(AssessmentAttempt.id), func.avg(AssessmentAttempt.percentage))
            .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
            .where(Assessment.course_id == course.id, AssessmentAttempt.status != IN_PROGRESS,
                   AssessmentAttempt.student_id.in_(student_ids))
            .group_by(AssessmentAttempt.student_id)
        ).all():
            attempts[sid] = (cnt, round(float(avg), 1) if avg is not None else None)

    student_rows = [
        TeacherStudentRow(
            id=s.id, full_name=s.full_name, completed_lessons=done.get(s.id, 0), total_lessons=total_lessons,
            attempts_count=attempts.get(s.id, (0, None))[0], average_percentage=attempts.get(s.id, (0, None))[1],
        )
        for s in students
    ]

    assessments = db.scalars(
        select(Assessment).where(Assessment.course_id == course.id, Assessment.is_active.is_(True))
        .order_by(Assessment.id)
    ).all()
    stats: dict[int, tuple[int, float | None, float | None]] = {}
    qcounts: dict[int, int] = {}
    if assessments:
        ids = [a.id for a in assessments]
        qcounts = dict(db.execute(
            select(Question.assessment_id, func.count(Question.id))
            .where(Question.assessment_id.in_(ids)).group_by(Question.assessment_id)
        ).all())
        for aid, cnt, avg, passed in db.execute(
            select(AssessmentAttempt.assessment_id, func.count(AssessmentAttempt.id),
                   func.avg(AssessmentAttempt.percentage),
                   func.sum(cast(AssessmentAttempt.is_passed, Integer)))
            .where(AssessmentAttempt.assessment_id.in_(ids), AssessmentAttempt.status != IN_PROGRESS)
            .group_by(AssessmentAttempt.assessment_id)
        ).all():
            stats[aid] = (cnt, round(float(avg), 1) if avg is not None else None,
                          round(int(passed or 0) * 100 / cnt, 1) if cnt else None)

    assessment_rows = [
        TeacherAssessmentRow(
            id=a.id, title=a.title, is_published=a.is_published, question_count=qcounts.get(a.id, 0),
            attempts_count=stats.get(a.id, (0, None, None))[0],
            average_percentage=stats.get(a.id, (0, None, None))[1],
            pass_rate=stats.get(a.id, (0, None, None))[2],
        )
        for a in assessments
    ]

    return TeacherCourseDetail(
        id=course.id, name=course.name, description=course.description, subject_name=subject_name,
        grade_name=grade_name, term_name=term_name, total_lessons=total_lessons,
        students=student_rows, assessments=assessment_rows,
    )


@router.get("/assessments/{assessment_id}/results", response_model=AttemptPage)
def results(
    assessment_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    teacher: User = Depends(teacher_only),
):
    a = db.get(Assessment, assessment_id)
    if a is None or not a.is_active:
        raise HTTPException(404, "الاختبار غير موجود.")
    _assigned_course(db, teacher, a.course_id)  # لازم يكون من كورساته
    return assessment_results(assessment_id=a.id, page=page, limit=limit, db=db, actor=teacher)
