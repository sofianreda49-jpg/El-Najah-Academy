"""إدارة الهيكل التعليمي.

الصلاحيات:
- المالك (super_admin): يدير الهيكل الأساسي (مراحل، صفوف، سنوات، أترام، مواد) وكل المحتوى.
- المدير (admin): يقرأ الهيكل ويدير كل المحتوى (كورسات، وحدات، دروس).
- المعلم (teacher): يقرأ الهيكل، وينشئ كورساته ويدير محتواها هي بس (الكورس بيتعيّن عليه تلقائياً).

"الحذف" أرشفة ولا يمسح بيانات. التعديل بـ PATCH (الحقول المرسلة فقط).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import (
    AcademicYear, Course, Grade, Lesson, Stage, Subject, Term, Unit,
)
from app.models.user import Role, User
from app.schemas.academy import (
    AcademicYearCreate, AcademicYearOut, AcademicYearUpdate, CourseCreate, CourseOut,
    CourseOutline, CourseUpdate, GradeCreate, GradeOut, GradeUpdate, LessonCreate, LessonOut,
    LessonUpdate, MessageOut, StageCreate, StageOut, StageUpdate, SubjectCreate,
    SubjectOut, SubjectUpdate, TermCreate, TermOut, TermUpdate, UnitCreate, UnitOut,
    UnitUpdate, UnitWithLessons,
)
from app.services import academy as svc
from app.services import access
from app.services import audit

router = APIRouter(prefix="/academy", tags=["academy"])

owner = require_roles(Role.super_admin)
editor = require_roles(Role.super_admin, Role.admin, Role.teacher)


def _check_parents(db: Session, payload: dict, checks: list[tuple]) -> None:
    """يتأكد إن أي أب اتبعت في الطلب موجود ومش مؤرشف."""
    for field, model, message in checks:
        if payload.get(field) is not None:
            svc.ensure_active(db, model, payload[field], message)


# =========================================================
# المراحل
# =========================================================

@router.get("/stages", response_model=list[StageOut])
def list_stages(include_archived: bool = False, db: Session = Depends(get_db),
                _: User = Depends(editor)):
    return svc.list_items(db, Stage, [], include_archived)


@router.post("/stages", response_model=StageOut, status_code=201)
def create_stage(data: StageCreate, db: Session = Depends(get_db), actor: User = Depends(owner)):
    return svc.create_item(db, Stage, data.model_dump(), ("name",), "المرحلة موجودة بالفعل",
                           actor_id=actor.id, entity="stage")


@router.patch("/stages/{stage_id}", response_model=StageOut)
def update_stage(stage_id: int, data: StageUpdate, db: Session = Depends(get_db),
                 actor: User = Depends(owner)):
    obj = svc.get_active(db, Stage, stage_id, "المرحلة غير موجودة")
    return svc.update_item(db, obj, data.model_dump(exclude_unset=True), ("name",),
                           "المرحلة موجودة بالفعل", actor_id=actor.id, entity="stage")


@router.delete("/stages/{stage_id}", response_model=MessageOut)
def delete_stage(stage_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, Stage, stage_id, "المرحلة غير موجودة")
    return svc.archive_item(db, obj, "المرحلة", [(Grade, "stage_id", "الصفوف")],
                            actor_id=actor.id, entity="stage")


# =========================================================
# الصفوف
# =========================================================

@router.get("/grades", response_model=list[GradeOut])
def list_grades(stage_id: int | None = None, include_archived: bool = False,
                db: Session = Depends(get_db), _: User = Depends(editor)):
    filters = [Grade.stage_id == stage_id] if stage_id is not None else []
    return svc.list_items(db, Grade, filters, include_archived)


@router.post("/grades", response_model=GradeOut, status_code=201)
def create_grade(data: GradeCreate, db: Session = Depends(get_db), actor: User = Depends(owner)):
    svc.ensure_active(db, Stage, data.stage_id, "المرحلة غير موجودة")
    return svc.create_item(db, Grade, data.model_dump(), ("stage_id", "name"),
                           "هذا الصف موجود بالفعل في هذه المرحلة", actor_id=actor.id, entity="grade")


@router.patch("/grades/{grade_id}", response_model=GradeOut)
def update_grade(grade_id: int, data: GradeUpdate, db: Session = Depends(get_db),
                 actor: User = Depends(owner)):
    obj = svc.get_active(db, Grade, grade_id, "الصف غير موجود")
    payload = data.model_dump(exclude_unset=True)
    _check_parents(db, payload, [("stage_id", Stage, "المرحلة غير موجودة")])
    return svc.update_item(db, obj, payload, ("stage_id", "name"),
                           "هذا الصف موجود بالفعل في هذه المرحلة", actor_id=actor.id, entity="grade")


@router.delete("/grades/{grade_id}", response_model=MessageOut)
def delete_grade(grade_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, Grade, grade_id, "الصف غير موجود")
    return svc.archive_item(db, obj, "الصف", [(Course, "grade_id", "الكورسات")],
                            actor_id=actor.id, entity="grade")


# =========================================================
# السنوات الدراسية (مستقلة عن الصفوف)
# =========================================================

@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_years(include_archived: bool = False, db: Session = Depends(get_db),
               _: User = Depends(editor)):
    return svc.list_items(db, AcademicYear, [], include_archived)


@router.post("/academic-years", response_model=AcademicYearOut, status_code=201)
def create_year(data: AcademicYearCreate, db: Session = Depends(get_db),
                actor: User = Depends(owner)):
    return svc.create_item(db, AcademicYear, data.model_dump(), ("name",),
                           "هذه السنة الدراسية موجودة بالفعل", actor_id=actor.id,
                           entity="academic_year")


@router.patch("/academic-years/{year_id}", response_model=AcademicYearOut)
def update_year(year_id: int, data: AcademicYearUpdate, db: Session = Depends(get_db),
                actor: User = Depends(owner)):
    obj = svc.get_active(db, AcademicYear, year_id, "السنة الدراسية غير موجودة")
    return svc.update_item(db, obj, data.model_dump(exclude_unset=True), ("name",),
                           "هذه السنة الدراسية موجودة بالفعل", actor_id=actor.id,
                           entity="academic_year")


@router.post("/academic-years/{year_id}/set-current", response_model=AcademicYearOut)
def set_current_year(year_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, AcademicYear, year_id, "السنة الدراسية غير موجودة")
    if not obj.is_current:
        db.execute(update(AcademicYear).where(AcademicYear.is_current.is_(True)).values(is_current=False))
        db.flush()
        obj.is_current = True
        audit.log_action(db, actor_id=actor.id, action=audit.ACADEMY_UPDATED,
                         target_type="academic_year", target_id=obj.id,
                         detail=f"current={obj.name}")
        db.commit()
        db.refresh(obj)
    return obj


@router.delete("/academic-years/{year_id}", response_model=MessageOut)
def delete_year(year_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, AcademicYear, year_id, "السنة الدراسية غير موجودة")
    if obj.is_current:
        raise HTTPException(409, "لا يمكن حذف السنة الدراسية الحالية. اختر سنة أخرى كحالية أولاً.")
    return svc.archive_item(db, obj, "السنة الدراسية", [(Term, "academic_year_id", "الأترام")],
                            actor_id=actor.id, entity="academic_year")


# =========================================================
# الأترام
# =========================================================

@router.get("/terms", response_model=list[TermOut])
def list_terms(academic_year_id: int | None = None, include_archived: bool = False,
               db: Session = Depends(get_db), _: User = Depends(editor)):
    filters = [Term.academic_year_id == academic_year_id] if academic_year_id is not None else []
    return svc.list_items(db, Term, filters, include_archived)


@router.post("/terms", response_model=TermOut, status_code=201)
def create_term(data: TermCreate, db: Session = Depends(get_db), actor: User = Depends(owner)):
    svc.ensure_active(db, AcademicYear, data.academic_year_id, "السنة الدراسية غير موجودة")
    return svc.create_item(db, Term, data.model_dump(), ("academic_year_id", "name"),
                           "هذا الترم موجود بالفعل في هذه السنة الدراسية",
                           actor_id=actor.id, entity="term")


@router.patch("/terms/{term_id}", response_model=TermOut)
def update_term(term_id: int, data: TermUpdate, db: Session = Depends(get_db),
                actor: User = Depends(owner)):
    obj = svc.get_active(db, Term, term_id, "الترم غير موجود")
    payload = data.model_dump(exclude_unset=True)
    _check_parents(db, payload, [("academic_year_id", AcademicYear, "السنة الدراسية غير موجودة")])
    return svc.update_item(db, obj, payload, ("academic_year_id", "name"),
                           "هذا الترم موجود بالفعل في هذه السنة الدراسية",
                           actor_id=actor.id, entity="term")


@router.delete("/terms/{term_id}", response_model=MessageOut)
def delete_term(term_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, Term, term_id, "الترم غير موجود")
    return svc.archive_item(db, obj, "الترم", [(Course, "term_id", "الكورسات")],
                            actor_id=actor.id, entity="term")


# =========================================================
# المواد (كتالوج مستقل)
# =========================================================

@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(include_archived: bool = False, db: Session = Depends(get_db),
                  _: User = Depends(editor)):
    return svc.list_items(db, Subject, [], include_archived)


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db), actor: User = Depends(owner)):
    return svc.create_item(db, Subject, data.model_dump(), ("name",), "هذه المادة موجودة بالفعل",
                           actor_id=actor.id, entity="subject")


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: int, data: SubjectUpdate, db: Session = Depends(get_db),
                   actor: User = Depends(owner)):
    obj = svc.get_active(db, Subject, subject_id, "المادة غير موجودة")
    return svc.update_item(db, obj, data.model_dump(exclude_unset=True), ("name",),
                           "هذه المادة موجودة بالفعل", actor_id=actor.id, entity="subject")


@router.delete("/subjects/{subject_id}", response_model=MessageOut)
def delete_subject(subject_id: int, db: Session = Depends(get_db), actor: User = Depends(owner)):
    obj = svc.get_active(db, Subject, subject_id, "المادة غير موجودة")
    return svc.archive_item(db, obj, "المادة", [(Course, "subject_id", "الكورسات")],
                            actor_id=actor.id, entity="subject")


# =========================================================
# الكورسات (صف + ترم + مادة)
# =========================================================

_COURSE_PARENTS = [
    ("grade_id", Grade, "الصف غير موجود"),
    ("term_id", Term, "الترم غير موجود"),
    ("subject_id", Subject, "المادة غير موجودة"),
]
_COURSE_UNIQUE = ("grade_id", "term_id", "subject_id", "name")
_COURSE_DUP = "هذا الكورس موجود بالفعل لنفس الصف والترم والمادة"


@router.get("/courses", response_model=list[CourseOut])
def list_courses(grade_id: int | None = None, term_id: int | None = None,
                 subject_id: int | None = None, include_archived: bool = False,
                 db: Session = Depends(get_db), actor: User = Depends(editor)):
    filters = []
    if grade_id is not None:
        filters.append(Course.grade_id == grade_id)
    if term_id is not None:
        filters.append(Course.term_id == term_id)
    if subject_id is not None:
        filters.append(Course.subject_id == subject_id)
    if actor.role == Role.teacher:  # المعلم يشوف كورساته بس
        filters.append(Course.id.in_(access.assigned_course_ids(actor.id)))
    return svc.list_items(db, Course, filters, include_archived)


@router.get("/courses/{course_id}", response_model=CourseOutline)
def course_outline(course_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    """الكورس بكل وحداته ودروسه في طلب واحد (لشاشة منشئ الكورس)."""
    access.ensure_course_access(db, actor, course_id)
    course = svc.get_active(db, Course, course_id, "الكورس غير موجود")
    units = db.scalars(
        select(Unit)
        .where(Unit.course_id == course.id, Unit.is_active.is_(True))
        .order_by(Unit.order_index, Unit.id)
    ).all()

    lessons_by_unit: dict[int, list] = {}
    if units:
        lessons = db.scalars(
            select(Lesson)
            .where(Lesson.unit_id.in_([u.id for u in units]), Lesson.is_active.is_(True))
            .order_by(Lesson.order_index, Lesson.id)
        ).all()
        for lesson in lessons:
            lessons_by_unit.setdefault(lesson.unit_id, []).append(lesson)

    data = CourseOut.model_validate(course).model_dump()
    data["units"] = [
        UnitWithLessons(
            **UnitOut.model_validate(u).model_dump(),
            lessons=[LessonOut.model_validate(x) for x in lessons_by_unit.get(u.id, [])],
        )
        for u in units
    ]
    return CourseOutline(**data)


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(data: CourseCreate, db: Session = Depends(get_db), actor: User = Depends(editor)):
    payload = data.model_dump()
    _check_parents(db, payload, _COURSE_PARENTS)
    course = svc.create_item(db, Course, payload, _COURSE_UNIQUE, _COURSE_DUP,
                             actor_id=actor.id, entity="course")
    if actor.role == Role.teacher:
        access.assign_teacher(db, actor, course.id)  # الكورس يتعيّن على منشئه
        db.refresh(course)
    return course


@router.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, data: CourseUpdate, db: Session = Depends(get_db),
                  actor: User = Depends(editor)):
    access.ensure_course_access(db, actor, course_id)
    obj = svc.get_active(db, Course, course_id, "الكورس غير موجود")
    payload = data.model_dump(exclude_unset=True)
    _check_parents(db, payload, _COURSE_PARENTS)
    return svc.update_item(db, obj, payload, _COURSE_UNIQUE, _COURSE_DUP,
                           actor_id=actor.id, entity="course")


@router.delete("/courses/{course_id}", response_model=MessageOut)
def delete_course(course_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    access.ensure_course_access(db, actor, course_id)
    obj = svc.get_active(db, Course, course_id, "الكورس غير موجود")
    return svc.archive_item(db, obj, "الكورس", [(Unit, "course_id", "الوحدات")],
                            actor_id=actor.id, entity="course")


# =========================================================
# الوحدات
# =========================================================

@router.get("/units", response_model=list[UnitOut])
def list_units(course_id: int | None = None, include_archived: bool = False,
               db: Session = Depends(get_db), actor: User = Depends(editor)):
    filters = []
    if course_id is not None:
        access.ensure_course_access(db, actor, course_id)
        filters.append(Unit.course_id == course_id)
    elif actor.role == Role.teacher:
        filters.append(Unit.course_id.in_(access.assigned_course_ids(actor.id)))
    return svc.list_items(db, Unit, filters, include_archived)


@router.post("/units", response_model=UnitOut, status_code=201)
def create_unit(data: UnitCreate, db: Session = Depends(get_db), actor: User = Depends(editor)):
    access.ensure_course_access(db, actor, data.course_id)
    svc.ensure_active(db, Course, data.course_id, "الكورس غير موجود")
    return svc.create_item(db, Unit, data.model_dump(), ("course_id", "name"),
                           "هذه الوحدة موجودة بالفعل في هذا الكورس", actor_id=actor.id, entity="unit")


@router.patch("/units/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: int, data: UnitUpdate, db: Session = Depends(get_db),
                actor: User = Depends(editor)):
    obj = svc.get_active(db, Unit, unit_id, "الوحدة غير موجودة")
    access.ensure_course_access(db, actor, obj.course_id, "الوحدة غير موجودة")
    payload = data.model_dump(exclude_unset=True)
    target_course = payload.get("course_id")
    if target_course is not None and target_course != obj.course_id:
        access.ensure_course_access(db, actor, target_course)  # نقل لكورس تاني: لازم يكون بتاعه
    _check_parents(db, payload, [("course_id", Course, "الكورس غير موجود")])
    return svc.update_item(db, obj, payload, ("course_id", "name"),
                           "هذه الوحدة موجودة بالفعل في هذا الكورس", actor_id=actor.id, entity="unit")


@router.delete("/units/{unit_id}", response_model=MessageOut)
def delete_unit(unit_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    obj = svc.get_active(db, Unit, unit_id, "الوحدة غير موجودة")
    access.ensure_course_access(db, actor, obj.course_id, "الوحدة غير موجودة")
    return svc.archive_item(db, obj, "الوحدة", [(Lesson, "unit_id", "الدروس")],
                            actor_id=actor.id, entity="unit")


# =========================================================
# الدروس
# =========================================================

@router.get("/lessons", response_model=list[LessonOut])
def list_lessons(unit_id: int | None = None, include_archived: bool = False,
                 db: Session = Depends(get_db), actor: User = Depends(editor)):
    filters = []
    if unit_id is not None:
        if actor.role == Role.teacher:
            unit = db.get(Unit, unit_id)
            if unit is None or not access.can_edit_course(db, actor, unit.course_id):
                raise HTTPException(404, "الوحدة غير موجودة")
        filters.append(Lesson.unit_id == unit_id)
    elif actor.role == Role.teacher:
        filters.append(Lesson.unit_id.in_(
            select(Unit.id).where(Unit.course_id.in_(access.assigned_course_ids(actor.id)))
        ))
    return svc.list_items(db, Lesson, filters, include_archived)


def _unit_for_edit(db: Session, actor: User, unit_id: int) -> Unit:
    """الوحدة لازم تكون موجودة ويكون للمستخدم حق تعديل كورسها."""
    unit = db.get(Unit, unit_id)
    if unit is None or not access.can_edit_course(db, actor, unit.course_id):
        raise HTTPException(404, "الوحدة غير موجودة")
    return unit


@router.post("/lessons", response_model=LessonOut, status_code=201)
def create_lesson(data: LessonCreate, db: Session = Depends(get_db), actor: User = Depends(editor)):
    _unit_for_edit(db, actor, data.unit_id)
    svc.ensure_active(db, Unit, data.unit_id, "الوحدة غير موجودة")
    return svc.create_item(db, Lesson, data.model_dump(), ("unit_id", "title"),
                           "هذا الدرس موجود بالفعل في هذه الوحدة", actor_id=actor.id, entity="lesson")


@router.patch("/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(lesson_id: int, data: LessonUpdate, db: Session = Depends(get_db),
                  actor: User = Depends(editor)):
    obj = svc.get_active(db, Lesson, lesson_id, "الدرس غير موجود")
    _unit_for_edit(db, actor, obj.unit_id)
    payload = data.model_dump(exclude_unset=True)
    target_unit = payload.get("unit_id")
    if target_unit is not None and target_unit != obj.unit_id:
        _unit_for_edit(db, actor, target_unit)  # نقل لوحدة تانية: لازم تكون من كورساته
    _check_parents(db, payload, [("unit_id", Unit, "الوحدة غير موجودة")])
    return svc.update_item(db, obj, payload, ("unit_id", "title"),
                           "هذا الدرس موجود بالفعل في هذه الوحدة", actor_id=actor.id, entity="lesson")


@router.delete("/lessons/{lesson_id}", response_model=MessageOut)
def delete_lesson(lesson_id: int, db: Session = Depends(get_db), actor: User = Depends(editor)):
    obj = svc.get_active(db, Lesson, lesson_id, "الدرس غير موجود")
    _unit_for_edit(db, actor, obj.unit_id)
    return svc.archive_item(db, obj, "الدرس", [], actor_id=actor.id, entity="lesson")
