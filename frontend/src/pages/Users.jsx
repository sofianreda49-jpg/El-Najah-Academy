import { useEffect, useState } from 'react'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AsyncBlock from '../components/AsyncBlock.jsx'
import ChildrenModal from '../components/ChildrenModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CredentialsModal from '../components/CredentialsModal.jsx'
import FormModal from '../components/FormModal.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Pagination from '../components/Pagination.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TeacherCoursesModal from '../components/TeacherCoursesModal.jsx'
import { useToast } from '../components/Toast.jsx'
import { ROLE_LABELS } from '../constants.js'
import { useApi } from '../hooks/useApi.js'
import { useAcademyRefs } from '../hooks/useAcademyRefs.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { formatDateTime } from '../utils/format.js'
import { newCfg } from '../utils/ids.js'
import { generatePassword } from '../utils/password.js'
import { tr } from '../i18n/index.jsx'

// نفس قواعد الباك إند (الباك إند هو اللي بيفرضها فعلياً)
const MANAGEABLE = {
  super_admin: ['admin', 'teacher', 'student', 'parent'],
  admin: ['teacher', 'student', 'parent'],
}
const LIMIT = 20

export default function Users() {
  const { user: me } = useAuth()
  const toast = useToast()
  const manageable = MANAGEABLE[me.role] || []
  const { refs } = useAcademyRefs()
  const gradeOptions = refs ? refs.grades.map((g) => ({ value: g.id, label: g.name })) : []

  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('desc')

  function toggleSort(field) {
    if (sort === field) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(field)
      setOrder('asc')
    }
    setPage(1)
  }

  const [formCfg, setFormCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)
  const [credentials, setCredentials] = useState(null)
  const [childrenFor, setChildrenFor] = useState(null)
  const [coursesFor, setCoursesFor] = useState(null)

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, role, status])

  const { data, loading, error, reload } = useApi(() => {
    const params = new URLSearchParams({ page, limit: LIMIT, sort, order })
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
    if (role) params.set('role', role)
    if (status) params.set('is_active', status === 'active' ? 'true' : 'false')
    return api(`/users?${params}`)
  }, [page, debouncedQ, role, status, sort, order])

  const canManage = (u) => u.id !== me.id && manageable.includes(u.role)

  function openCreate() {
    setFormCfg(newCfg({
      title: tr("إضافة مستخدم"),
      submitLabel: tr("إنشاء الحساب"),
      note: tr("سيُطلب من المستخدم تغيير كلمة المرور المؤقتة عند أول دخول."),
      fields: [
        { name: 'full_name', label: tr("الاسم الكامل"), required: true },
        { name: 'email', label: tr("البريد الإلكتروني"), type: 'email', ltr: true, required: true },
        {
          name: 'role', label: tr("الدور"), type: 'select', required: true,
          options: manageable.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
        },
        {
          name: 'grade_id', label: tr("الصف الدراسي"), type: 'select', required: true,
          options: gradeOptions, showIf: (v) => v.role === 'student',
        },
        {
          name: 'password', label: tr("كلمة مرور مؤقتة"), ltr: true, required: true, generate: true,
          help: tr("8 أحرف على الأقل. زر «توليد» يعمل كلمة قوية عشوائية."),
        },
      ],
      initial: { role: 'student', password: generatePassword() },
      onSubmit: async (v) => {
        const created = await api('/users', {
          method: 'POST',
          body: {
            full_name: v.full_name, email: v.email.toLowerCase(), password: v.password, role: v.role,
            grade_id: v.grade_id ? Number(v.grade_id) : undefined,
          },
        })
        setCredentials({ name: created.full_name, email: created.email, password: v.password })
        reload()
      },
    }))
  }

  function openReset(u) {
    setFormCfg(newCfg({
      title: tr("إعادة تعيين كلمة المرور: {full_name}", { full_name: u.full_name }),
      submitLabel: tr("إعادة التعيين"),
      note: tr("سيتم إنهاء كل جلسات المستخدم الحالية، وسيُطلب منه تغيير كلمة المرور عند الدخول."),
      fields: [
        { name: 'new_password', label: tr("كلمة مرور مؤقتة جديدة"), ltr: true, required: true, generate: true },
      ],
      initial: { new_password: generatePassword() },
      onSubmit: async (v) => {
        await api(`/users/${u.id}/reset-password`, { method: 'POST', body: { new_password: v.new_password } })
        setCredentials({ name: u.full_name, email: u.email, password: v.new_password })
        reload()
      },
    }))
  }

  function openGrade(u) {
    setFormCfg(newCfg({
      title: tr("تغيير صف الطالب: {full_name}", { full_name: u.full_name }),
      note: tr("الطالب هيشوف كورسات الصف الجديد من أول دخول بعد التغيير."),
      fields: [{ name: 'grade_id', label: tr("الصف الدراسي"), type: 'select', required: true, options: gradeOptions }],
      initial: { grade_id: u.grade_id ?? '' },
      onSubmit: async (v) => {
        await api(`/users/${u.id}`, { method: 'PATCH', body: { grade_id: Number(v.grade_id) } })
        toast.success(tr("تم تحديث الصف"))
        reload()
      },
    }))
  }

  function openToggle(u) {
    const activating = !u.is_active
    setConfirmCfg(newCfg({
      title: activating ? tr("تفعيل الحساب") : tr("إيقاف الحساب"),
      message: activating
        ? tr("هل تريد تفعيل حساب «{full_name}»؟", { full_name: u.full_name })
        : tr("هل تريد إيقاف حساب «{full_name}»؟ لن يتمكن من الدخول حتى تعيد تفعيله.", { full_name: u.full_name }),
      confirmLabel: activating ? tr("تفعيل") : tr("إيقاف"),
      danger: !activating,
      onConfirm: async () => {
        await api(`/users/${u.id}`, { method: 'PATCH', body: { is_active: activating } })
        toast.success(activating ? tr("تم تفعيل الحساب") : tr("تم إيقاف الحساب"))
        reload()
      },
    }))
  }

  return (
    <>
      <PageHeader
        title={tr("المستخدمون")}
        subtitle={tr("إنشاء الحسابات وإدارتها.")}
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            <Icon name="plus" size={18} />{' '}{tr("إضافة مستخدم")}</button>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input className="input" type="search" placeholder={tr("ابحث بالاسم أو البريد...")} value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input toolbar-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{tr("كل الأدوار")}</option>
          {Object.entries(ROLE_LABELS).filter(([r]) => me.role === 'super_admin' || r !== 'super_admin')
            .map(([r, label]) => <option key={r} value={r}>{label}</option>)}
        </select>
        <select className="input toolbar-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tr("كل الحالات")}</option>
          <option value="active">{tr("نشط")}</option>
          <option value="inactive">{tr("موقوف")}</option>
        </select>
      </div>

      <div className="card">
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
          {data && data.items.length === 0 ? (
            <div className="empty-state">
              <h2>{tr("لا يوجد مستخدمون")}</h2>
              <p className="muted">{tr("غيّر البحث أو الفلتر، أو أضف مستخدماً جديداً.")}</p>
            </div>
          ) : (
            data && (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <SortHeader field="full_name" sort={sort} order={order} onSort={toggleSort}>{tr("الاسم")}</SortHeader>
                        <SortHeader field="email" sort={sort} order={order} onSort={toggleSort}>{tr("البريد")}</SortHeader>
                        <SortHeader field="role" sort={sort} order={order} onSort={toggleSort}>{tr("الدور")}</SortHeader>
                        <th>{tr("الصف")}</th><th>{tr("الحالة")}</th>
                        <SortHeader field="last_login_at" sort={sort} order={order} onSort={toggleSort}>{tr("آخر دخول")}</SortHeader>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.full_name}</strong></td>
                          <td className="ltr-cell">{u.email}</td>
                          <td><span className="badge badge-muted">{ROLE_LABELS[u.role]}</span></td>
                          <td>
                            {u.role === 'student'
                              ? (u.grade_id
                                  ? (refs ? refs.gradeName(u.grade_id) : '...')
                                  : <span className="badge badge-bad">{tr("غير محدد")}</span>)
                              : '—'}
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-ok' : 'badge-bad'}`}>
                              {u.is_active ? tr("نشط") : tr("موقوف")}
                            </span>
                            {u.must_change_password && <span className="badge badge-gold mr-6">{tr("باسورد مؤقت")}</span>}
                          </td>
                          <td className="muted">{formatDateTime(u.last_login_at)}</td>
                          <td>
                            {canManage(u) && (
                              <div className="row-actions">
                                {u.role === 'teacher' && (
                                  <button className="icon-btn" type="button" title={tr("كورسات المعلم")}
                                          aria-label={tr("كورسات المعلم")} onClick={() => setCoursesFor(u)}>
                                    <Icon name="academy" size={18} />
                                  </button>
                                )}
                                {u.role === 'parent' && (
                                  <button className="icon-btn" type="button" title={tr("الأبناء")}
                                          aria-label={tr("الأبناء")} onClick={() => setChildrenFor(u)}>
                                    <Icon name="users" size={18} />
                                  </button>
                                )}
                                {u.role === 'student' && (
                                  <button className="icon-btn" type="button" title={tr("تغيير الصف")}
                                          aria-label={tr("تغيير الصف")} onClick={() => openGrade(u)}>
                                    <Icon name="layers" size={18} />
                                  </button>
                                )}
                                <button className="icon-btn" type="button" title={tr("إعادة تعيين كلمة المرور")}
                                        aria-label={tr("إعادة تعيين كلمة المرور")} onClick={() => openReset(u)}>
                                  <Icon name="key" size={18} />
                                </button>
                                <button className="icon-btn" type="button"
                                        title={u.is_active ? tr("إيقاف الحساب") : tr("تفعيل الحساب")}
                                        aria-label={u.is_active ? tr("إيقاف الحساب") : tr("تفعيل الحساب")}
                                        onClick={() => openToggle(u)}>
                                  <Icon name={u.is_active ? 'ban' : 'check'} size={18} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} limit={LIMIT} total={data.total} onChange={setPage} />
              </>
            )
          )}
        </AsyncBlock>
      </div>

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
      <CredentialsModal data={credentials} onClose={() => setCredentials(null)} />
      {childrenFor && <ChildrenModal parent={childrenFor} onClose={() => setChildrenFor(null)} />}
      {coursesFor && <TeacherCoursesModal teacher={coursesFor} onClose={() => setCoursesFor(null)} />}
    </>
  )
}
