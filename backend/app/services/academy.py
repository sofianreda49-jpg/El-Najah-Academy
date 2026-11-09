"""منطق مشترك لإدارة الهيكل التعليمي: إنشاء، تعديل، أرشفة، مع رسائل عربية واضحة."""
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.services import audit


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "تعذر الحفظ: يوجد تعارض في البيانات (اسم مكرر أو عنصر مرتبط بعناصر أخرى)."
        )


def _label(data: dict) -> str | None:
    return data.get("name") or data.get("title")


def get_active(db: Session, model, item_id: int, not_found: str):
    obj = db.get(model, item_id)
    if obj is None or not obj.is_active:
        raise HTTPException(404, not_found)
    return obj


def ensure_active(db: Session, model, item_id: int, not_found: str) -> None:
    get_active(db, model, item_id, not_found)


def list_items(db: Session, model, filters: list, include_archived: bool):
    stmt = select(model).where(*filters)
    if not include_archived:
        stmt = stmt.where(model.is_active.is_(True))
    if hasattr(model, "order_index"):
        stmt = stmt.order_by(model.order_index, model.id)
    else:
        stmt = stmt.order_by(model.id)
    return db.scalars(stmt).all()


def create_item(db: Session, model, data: dict, unique_cols: tuple, dup_msg: str,
                *, actor_id: int, entity: str):
    existing = db.scalar(
        select(model).where(*[getattr(model, c) == data[c] for c in unique_cols])
    )
    if existing:
        if existing.is_active:
            raise HTTPException(409, dup_msg)
        # عنصر مؤرشف بنفس الاسم: نعيد تفعيله بالبيانات الجديدة
        for key, value in data.items():
            setattr(existing, key, value)
        existing.is_active = True
        obj = existing
    else:
        obj = model(**data)
        db.add(obj)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, dup_msg)

    audit.log_action(db, actor_id=actor_id, action=audit.ACADEMY_CREATED,
                     target_type=entity, target_id=obj.id, detail=_label(data))
    _commit(db)
    db.refresh(obj)
    return obj


def update_item(db: Session, obj, payload: dict, unique_cols: tuple, dup_msg: str,
                *, actor_id: int, entity: str):
    model = type(obj)
    columns = model.__table__.columns
    for key, value in payload.items():
        if value is None and not columns[key].nullable:
            raise HTTPException(422, "قيمة غير مسموحة لهذا الحقل.")

    merged = {c: payload.get(c, getattr(obj, c)) for c in unique_cols}
    clash = db.scalar(
        select(model).where(
            *[getattr(model, c) == merged[c] for c in unique_cols], model.id != obj.id
        )
    )
    if clash:
        raise HTTPException(
            409, dup_msg if clash.is_active else "يوجد عنصر مؤرشف بنفس الاسم. اختر اسماً مختلفاً."
        )

    for key, value in payload.items():
        setattr(obj, key, value)
    if payload:
        audit.log_action(db, actor_id=actor_id, action=audit.ACADEMY_UPDATED,
                         target_type=entity, target_id=obj.id,
                         detail=_label(merged) or _label(payload))
    _commit(db)
    db.refresh(obj)
    return obj


def archive_item(db: Session, obj, label: str, children: list[tuple],
                 *, actor_id: int, entity: str) -> dict:
    """children: قائمة (الموديل، اسم عمود الربط، الاسم بالجمع)."""
    for child_model, fk_name, plural in children:
        stmt = select(func.count(child_model.id)).where(getattr(child_model, fk_name) == obj.id)
        if hasattr(child_model, "is_active"):
            stmt = stmt.where(child_model.is_active.is_(True))
        count = db.scalar(stmt) or 0
        if count:
            raise HTTPException(
                409,
                f"لا يمكن حذف {label} لأن بها {count} من {plural}. احذف {plural} التابعة أولاً.",
            )

    obj.is_active = False
    audit.log_action(db, actor_id=actor_id, action=audit.ACADEMY_ARCHIVED,
                     target_type=entity, target_id=obj.id,
                     detail=getattr(obj, "name", None) or getattr(obj, "title", None))
    _commit(db)
    return {"message": f"تم حذف {label} بنجاح"}
