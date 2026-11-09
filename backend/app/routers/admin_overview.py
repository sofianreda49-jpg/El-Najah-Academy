"""نظرة عامة للمالك والمدير: أرقام حقيقية من قاعدة البيانات، من غير أي بيانات وهمية."""
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.academic import Course, Lesson
from app.models.assessment import IN_PROGRESS, Assessment, AssessmentAttempt
from app.models.audit import AuditLog
from app.models.progress import LessonProgress
from app.models.user import Role, User

router = APIRouter(prefix="/admin", tags=["admin-overview"])
staff = require_roles(Role.super_admin, Role.admin)

# عمليات الدخول بتزحم السجل، فمش بنعرضها في "آخر العمليات"
NOISY_ACTIONS = ("login", "login_failed", "google_login")
REQUESTABLE = (Role.student, Role.parent, Role.teacher)


class RoleCounts(BaseModel):
    students: int
    teachers: int
    parents: int
    admins: int


class ContentCounts(BaseModel):
    courses_total: int
    courses_published: int
    lessons_published: int
    assessments_published: int


class DayPoint(BaseModel):
    day: date
    lessons_completed: int
    attempts: int


class WeekTotals(BaseModel):
    lessons_completed: int
    attempts: int
    new_users: int


class PendingPreview(BaseModel):
    id: int
    full_name: str
    role: str
    created_at: datetime


class RecentEvent(BaseModel):
    id: int
    action: str
    actor_name: str | None
    target_type: str | None
    detail: str | None
    created_at: datetime


class AdminOverview(BaseModel):
    users: RoleCounts
    content: ContentCounts
    pending_total: int
    pending_preview: list[PendingPreview]
    activity: list[DayPoint]
    week: WeekTotals
    recent_events: list[RecentEvent]  # للمالك فقط


def _by_day(db: Session, column, since: datetime, *extra_filters) -> dict[date, int]:
    rows = db.execute(
        select(cast(column, Date), func.count())
        .where(column >= since, *extra_filters)
        .group_by(cast(column, Date))
    ).all()
    return {d: n for d, n in rows}


@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db), actor: User = Depends(staff)):
    # ---------- المستخدمون (المقبولين والنشطين) ----------
    counts = dict(db.execute(
        select(User.role, func.count(User.id))
        .where(User.approval_status == "approved", User.is_active.is_(True))
        .group_by(User.role)
    ).all())
    users = RoleCounts(
        students=counts.get(Role.student, 0), teachers=counts.get(Role.teacher, 0),
        parents=counts.get(Role.parent, 0),
        admins=counts.get(Role.admin, 0) + counts.get(Role.super_admin, 0),
    )

    # ---------- المحتوى ----------
    courses_total = db.scalar(select(func.count(Course.id)).where(Course.is_active.is_(True))) or 0
    courses_published = db.scalar(
        select(func.count(Course.id)).where(Course.is_active.is_(True), Course.is_published.is_(True))
    ) or 0
    lessons_published = db.scalar(
        select(func.count(Lesson.id)).where(Lesson.is_active.is_(True), Lesson.is_published.is_(True))
    ) or 0
    assessments_published = db.scalar(
        select(func.count(Assessment.id)).where(Assessment.is_active.is_(True), Assessment.is_published.is_(True))
    ) or 0

    # ---------- طلبات التسجيل ----------
    pending_filter = (User.approval_status == "pending", User.role.in_(REQUESTABLE))
    pending_total = db.scalar(select(func.count(User.id)).where(*pending_filter)) or 0
    pending_rows = db.scalars(
        select(User).where(*pending_filter).order_by(User.id.desc()).limit(5)
    ).all()

    # ---------- النشاط آخر 7 أيام ----------
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=6)
    since = datetime.combine(start_day, time.min, tzinfo=timezone.utc)

    lessons_by_day = _by_day(db, LessonProgress.completed_at, since)
    attempts_by_day = _by_day(
        db, AssessmentAttempt.submitted_at, since, AssessmentAttempt.status != IN_PROGRESS
    )
    new_users = db.scalar(
        select(func.count(User.id)).where(User.created_at >= since, User.role != Role.super_admin)
    ) or 0

    activity = []
    for i in range(7):
        d = start_day + timedelta(days=i)
        activity.append(DayPoint(
            day=d, lessons_completed=lessons_by_day.get(d, 0), attempts=attempts_by_day.get(d, 0)
        ))

    # ---------- آخر العمليات (المالك بس: سجل العمليات من صلاحياته) ----------
    events: list[RecentEvent] = []
    if actor.role == Role.super_admin:
        rows = db.execute(
            select(AuditLog, User.full_name)
            .outerjoin(User, User.id == AuditLog.actor_id)
            .where(AuditLog.action.notin_(NOISY_ACTIONS))
            .order_by(AuditLog.id.desc())
            .limit(8)
        ).all()
        events = [
            RecentEvent(id=log.id, action=log.action, actor_name=name, target_type=log.target_type,
                        detail=log.detail, created_at=log.created_at)
            for log, name in rows
        ]

    return AdminOverview(
        users=users,
        content=ContentCounts(
            courses_total=courses_total, courses_published=courses_published,
            lessons_published=lessons_published, assessments_published=assessments_published,
        ),
        pending_total=pending_total,
        pending_preview=[
            PendingPreview(id=u.id, full_name=u.full_name, role=u.role.value, created_at=u.created_at)
            for u in pending_rows
        ],
        activity=activity,
        week=WeekTotals(
            lessons_completed=sum(p.lessons_completed for p in activity),
            attempts=sum(p.attempts for p in activity), new_users=new_users,
        ),
        recent_events=events,
    )
