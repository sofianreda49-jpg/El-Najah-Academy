import { useState } from 'react'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AsyncBlock from '../components/AsyncBlock.jsx'
import FormModal from '../components/FormModal.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Pagination from '../components/Pagination.jsx'
import { useToast } from '../components/Toast.jsx'
import { ROLE_LABELS } from '../constants.js'
import { useAcademyRefs } from '../hooks/useAcademyRefs.js'
import { useApi } from '../hooks/useApi.js'
import { formatDateTime } from '../utils/format.js'
import { newCfg } from '../utils/ids.js'
import { tr } from '../i18n/index.jsx'

const LIMIT = 20
const statusTabs = () => [['pending', tr('قيد المراجعة')], ['rejected', tr('المرفوضة')]]

export default function Requests() {
  const { user: me } = useAuth()
  const toast = useToast()
  const { refs } = useAcademyRefs()
  const isOwner = me.role === 'super_admin'

  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [formCfg, setFormCfg] = useState(null)

  const { data, loading, error, reload } = useApi(
    () => api(`/registrations?status=${status}&page=${page}&limit=${LIMIT}`),
    [status, page],
  )

  const allowedRoles = (isOwner ? ['student', 'parent', 'teacher'] : ['student', 'parent'])
    .map((r) => ({ value: r, label: ROLE_LABELS[r] }))
  const locked = (r) => r.role === 'teacher' && !isOwner // المعلم قراره للمالك

  function openApprove(r) {
    setFormCfg(newCfg({
      title: tr("قبول طلب: {full_name}", { full_name: r.full_name }),
      submitLabel: tr("قبول وتفعيل الحساب"),
      note: r.note ? tr("ملاحظة المستخدم: {note}", { note: r.note }) : tr("تقدر تغيّر نوع الحساب قبل القبول."),
      fields: [
        { name: 'role', label: tr("نوع الحساب"), type: 'select', required: true, options: allowedRoles },
        {
          name: 'grade_id', label: tr("الصف الدراسي"), type: 'select', required: true,
          options: refs ? refs.grades.map((g) => ({ value: g.id, label: g.name })) : [],
          showIf: (v) => v.role === 'student' && !r.grade_id,
        },
      ],
      initial: { role: r.role },
      onSubmit: async (v) => {
        await api(`/registrations/${r.id}/approve`, {
          method: 'POST',
          body: { role: v.role, grade_id: v.grade_id ? Number(v.grade_id) : undefined },
        })
        toast.success(tr("تم قبول الطلب وتفعيل الحساب"))
        reload()
      },
    }))
  }

  function openReject(r) {
    setFormCfg(newCfg({
      title: tr("رفض طلب: {full_name}", { full_name: r.full_name }),
      submitLabel: tr("رفض الطلب"),
      fields: [{ name: 'reason', label: tr("سبب الرفض (اختياري، بيظهر للمستخدم)"), type: 'textarea', rows: 3 }],
      onSubmit: async (v) => {
        await api(`/registrations/${r.id}/reject`, { method: 'POST', body: { reason: v.reason ?? null } })
        toast.success(tr("تم رفض الطلب"))
        reload()
      },
    }))
  }

  return (
    <>
      <PageHeader title={tr("طلبات التسجيل")} subtitle={tr("راجع الطلبات الجديدة واعتمد نوع الحساب لكل شخص.")} />

      <div className="tabs" role="tablist">
        {statusTabs().map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={status === key}
                  className={`tab${status === key ? ' active' : ''}`}
                  onClick={() => { setStatus(key); setPage(1) }}>
            {label}
          </button>
        ))}
      </div>

      {!isOwner && <div className="alert alert-warn">{tr("اعتماد المعلمين من صلاحيات المالك فقط.")}</div>}

      <div className="card">
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
          {data && data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="check" size={28} /></div>
              <h2>{status === 'pending' ? tr("لا توجد طلبات جديدة") : tr("لا توجد طلبات مرفوضة")}</h2>
            </div>
          ) : (
            data && (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>{tr("الاسم")}</th><th>{tr("البريد")}</th><th>{tr("الدور المطلوب")}</th><th>{tr("الصف")}</th><th>{tr("ملاحظة")}</th><th>{tr("التاريخ")}</th><th /></tr>
                    </thead>
                    <tbody>
                      {data.items.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.full_name}</strong></td>
                          <td className="ltr-cell">{r.email}</td>
                          <td><span className="badge badge-muted">{ROLE_LABELS[r.role]}</span></td>
                          <td>{r.grade_id && refs ? refs.gradeName(r.grade_id) : '—'}</td>
                          <td className="note-cell">
                            {r.note || '—'}
                            {r.rejection_reason && <small className="muted">{' '}{tr("(السبب:")}{' '}{r.rejection_reason})</small>}
                          </td>
                          <td className="muted">{formatDateTime(r.created_at)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="btn btn-primary btn-sm" type="button" disabled={locked(r)}
                                      title={locked(r) ? tr("للمالك فقط") : ''} onClick={() => openApprove(r)}>
                                <Icon name="check" size={14} />{' '}{tr("قبول")}</button>
                              {status === 'pending' && (
                                <button className="btn btn-ghost btn-sm" type="button" disabled={locked(r)}
                                        onClick={() => openReject(r)}>{tr("رفض")}</button>
                              )}
                            </div>
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
    </>
  )
}
