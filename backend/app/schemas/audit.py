from datetime import datetime

from pydantic import BaseModel


class AuditOut(BaseModel):
    id: int
    actor_id: int | None
    actor_name: str | None
    action: str
    target_type: str | None
    target_id: int | None
    detail: str | None
    ip_address: str | None
    created_at: datetime


class AuditPage(BaseModel):
    items: list[AuditOut]
    total: int
    page: int
    limit: int
