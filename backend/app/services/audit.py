from sqlalchemy.orm import Session

from app.models.audit import AuditLog

LOGIN = "login"
LOGIN_FAILED = "login_failed"
ACCOUNT_LOCKED = "account_locked"
PASSWORD_CHANGED = "password_changed"
PASSWORD_RESET = "password_reset"
USER_CREATED = "user_created"
USER_UPDATED = "user_updated"
USER_ACTIVATED = "user_activated"
USER_DEACTIVATED = "user_deactivated"
ACADEMY_CREATED = "academy_created"
ACADEMY_UPDATED = "academy_updated"
ACADEMY_ARCHIVED = "academy_archived"
PARENT_LINKED = "parent_linked"
PARENT_UNLINKED = "parent_unlinked"
TEACHER_ASSIGNED = "teacher_assigned"
GOOGLE_LOGIN = "google_login"
REGISTRATION_REQUESTED = "registration_requested"
REGISTRATION_APPROVED = "registration_approved"
REGISTRATION_REJECTED = "registration_rejected"
ENROLLMENT_ADDED = "enrollment_added"
ENROLLMENT_REMOVED = "enrollment_removed"


def log_action(
    db: Session,
    *,
    actor_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    detail: str | None = None,
    ip: str | None = None,
) -> None:
    """يضيف سطر للسجل. الـ commit مسؤولية اللي بينادي (علشان يتحفظ مع العملية نفسها)."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
            ip_address=ip,
        )
    )
