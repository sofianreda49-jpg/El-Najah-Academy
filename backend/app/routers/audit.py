from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import Role, User
from app.schemas.audit import AuditOut, AuditPage

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=AuditPage)
def list_audit_logs(
    action: str | None = Query(default=None, max_length=50),
    actor_id: int | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.super_admin)),  # المالك فقط
):
    base = select(AuditLog)
    if action:
        base = base.where(AuditLog.action == action)
    if actor_id is not None:
        base = base.where(AuditLog.actor_id == actor_id)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(
        base.add_columns(User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .order_by(AuditLog.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    items = [
        AuditOut(
            id=log.id, actor_id=log.actor_id, actor_name=name, action=log.action,
            target_type=log.target_type, target_id=log.target_id,
            detail=log.detail, ip_address=log.ip_address, created_at=log.created_at,
        )
        for log, name in rows
    ]
    return AuditPage(items=items, total=total, page=page, limit=limit)
