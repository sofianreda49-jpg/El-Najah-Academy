import { useState } from 'react'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { newCfg } from '../../utils/ids.js'
import { tr } from '../../i18n/index.jsx'

export default function CourseStudents({ course }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data, loading, error, reload } = useApi(() => api(`/academy/courses/${course.id}/students`), [course.id])

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const added = await api(`/academy/courses/${course.id}/students`, {
        method: 'POST', body: { email: email.trim().toLowerCase() },
      })
      toast.success(tr("تمت إضافة {full_name}", { full_name: added.full_name }))
      setEmail('')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const askRemove = (s) => setConfirmCfg(newCfg({
    title: tr("إزالة الطالب"),
    message: tr("هل تريد إزالة «{full_name}» من هذا الكورس؟", { full_name: s.full_name }),
    confirmLabel: tr("إزالة"),
    danger: true,
    onConfirm: async () => {
      await api(`/academy/courses/${course.id}/students/${s.id}`, { method: 'DELETE' })
      toast.success(tr("تمت الإزالة"))
      reload()
    },
  }))

  return (
    <section className="card unit-card">
      <div className="section-head">
        <h3>{tr("طلاب الكورس")}</h3>
      </div>
      <p className="muted course-desc">
        {course.access === 'enrolled'
          ? tr("الكورس خاص: مايظهرش غير للطلاب اللي بتضيفهم هنا.")
          : tr("الكورس مفتوح لكل طلاب الصف. وهنا تضيف طلاباً إضافيين (من صف تاني مثلاً).")}
      </p>

      <form className="inline-form" onSubmit={add}>
        <input className="input ltr" type="email" placeholder={tr("البريد الإلكتروني للطالب")} value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn btn-secondary" type="submit" disabled={busy || !email}>
          <Icon name="plus" size={16} />{' '}{tr("إضافة طالب")}</button>
      </form>
      <small className="help">{tr("الطالب لازم يكون سجّل حسابه وتمت الموافقة عليه.")}</small>

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && data.length === 0 && <p className="muted">{tr("لا يوجد طلاب مضافون يدوياً.")}</p>}
        {data && data.length > 0 && (
          <div className="lessons enrolled-list">
            {data.map((s) => (
              <div className="tree-row" key={s.id}>
                <span>
                  <strong>{s.full_name}</strong>{' '}
                  <span className="muted ltr-inline">{s.email}</span>
                  {s.grade_name && <span className="badge badge-muted mr-6">{s.grade_name}</span>}
                </span>
                <button className="icon-btn sm" type="button" aria-label={tr("إزالة الطالب")} onClick={() => askRemove(s)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </AsyncBlock>

      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </section>
  )
}
