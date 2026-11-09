"""يملأ الهيكل الأساسي (مراحل، صفوف، سنة حالية، أترام، مواد) لو مش موجودين.

    python -m app.scripts.seed_academy

آمن تشغّله أكتر من مرة: بيضيف الناقص بس ومش بيكرر ولا بيمسح حاجة.
عدّل القوائم اللي تحت براحتك قبل التشغيل.
"""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.academic import AcademicYear, Grade, Stage, Subject, Term

STAGES = {
    "المرحلة الابتدائية": [
        "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
        "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
    ],
    "المرحلة الإعدادية": [
        "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
    ],
}
YEAR = "2026/2027"
TERMS = ["الترم الأول", "الترم الثاني"]
SUBJECTS = [
    "اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "العلوم",
    "الدراسات الاجتماعية", "التربية الدينية الإسلامية", "التربية الدينية المسيحية",
    "الحاسب الآلي",
]


def get_or_create(db, model, lookup: dict, extra: dict | None = None):
    obj = db.scalar(select(model).filter_by(**lookup))
    if obj:
        return obj, False
    obj = model(**lookup, **(extra or {}))
    db.add(obj)
    db.flush()
    return obj, True


def main() -> None:
    created = 0
    with SessionLocal() as db:
        for s_index, (stage_name, grades) in enumerate(STAGES.items(), start=1):
            stage, new = get_or_create(db, Stage, {"name": stage_name}, {"order_index": s_index})
            created += new
            for g_index, grade_name in enumerate(grades, start=1):
                _, new = get_or_create(
                    db, Grade, {"stage_id": stage.id, "name": grade_name}, {"order_index": g_index}
                )
                created += new

        has_current = db.scalar(select(AcademicYear.id).where(AcademicYear.is_current.is_(True)))
        year, new = get_or_create(db, AcademicYear, {"name": YEAR}, {"is_current": not has_current})
        created += new
        for t_index, term_name in enumerate(TERMS, start=1):
            _, new = get_or_create(
                db, Term, {"academic_year_id": year.id, "name": term_name}, {"order_index": t_index}
            )
            created += new

        for sub_index, subject_name in enumerate(SUBJECTS, start=1):
            _, new = get_or_create(db, Subject, {"name": subject_name}, {"order_index": sub_index})
            created += new

        db.commit()
    print(f"تم. عناصر جديدة اتضافت: {created}")


if __name__ == "__main__":
    main()
