import { tr } from './i18n/index.jsx'
export const ROLE_LABELS = {
  get super_admin() { return tr("المالك") },
  get admin() { return tr("مدير") },
  get teacher() { return tr("معلم") },
  get student() { return tr("طالب") },
  get parent() { return tr("ولي أمر") },
}

const HOME = { to: '/', get label() { return tr("الرئيسية") }, icon: 'home', end: true }

const STAFF_NAV = [
  HOME,
  { to: '/users', get label() { return tr("المستخدمون") }, icon: 'users' },
  { to: '/requests', get label() { return tr("طلبات التسجيل") }, icon: 'audit', badge: true },
  { to: '/academy', get label() { return tr("الأكاديمية") }, icon: 'academy' },
]

export const NAV = {
  super_admin: [...STAFF_NAV, { to: '/audit', get label() { return tr("سجل العمليات") }, icon: 'audit' }],
  admin: STAFF_NAV,
  teacher: [HOME, { to: '/academy', get label() { return tr("الأكاديمية") }, icon: 'academy' }],
  student: [HOME, { to: '/results', get label() { return tr("نتائجي") }, icon: 'audit' }],
  parent: [HOME],
}

export const ACTION_LABELS = {
  get login() { return tr("تسجيل دخول") },
  get login_failed() { return tr("محاولة دخول فاشلة") },
  get account_locked() { return tr("قفل حساب مؤقتاً") },
  get password_changed() { return tr("تغيير كلمة المرور") },
  get password_reset() { return tr("إعادة تعيين كلمة المرور") },
  get user_created() { return tr("إنشاء مستخدم") },
  get user_updated() { return tr("تعديل مستخدم") },
  get user_activated() { return tr("تفعيل حساب") },
  get user_deactivated() { return tr("إيقاف حساب") },
  get academy_created() { return tr("إضافة في الأكاديمية") },
  get academy_updated() { return tr("تعديل في الأكاديمية") },
  get academy_archived() { return tr("حذف من الأكاديمية") },
  get parent_linked() { return tr("ربط ولي أمر بطالب") },
  get parent_unlinked() { return tr("فك ربط ولي أمر") },
  get teacher_assigned() { return tr("تعيين كورسات لمعلم") },
  get google_login() { return tr("دخول بحساب جوجل") },
  get registration_requested() { return tr("طلب تسجيل جديد") },
  get registration_approved() { return tr("قبول طلب تسجيل") },
  get registration_rejected() { return tr("رفض طلب تسجيل") },
  get enrollment_added() { return tr("إضافة طالب لكورس") },
  get enrollment_removed() { return tr("إزالة طالب من كورس") },
}

export const ENTITY_LABELS = {
  get user() { return tr("مستخدم") },
  get stage() { return tr("مرحلة") },
  get grade() { return tr("صف") },
  get academic_year() { return tr("سنة دراسية") },
  get term() { return tr("ترم") },
  get subject() { return tr("مادة") },
  get course() { return tr("كورس") },
  get unit() { return tr("وحدة") },
  get lesson() { return tr("درس") },
  get assessment() { return tr("اختبار") },
  get question() { return tr("سؤال") },
}
