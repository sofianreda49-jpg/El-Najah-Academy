import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import FormModal from '../../components/FormModal.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { newCfg } from '../../utils/ids.js'
import { ASSESSMENT_DEFAULTS, KIND_LABELS, assessmentBody, assessmentFields } from './assessmentForm.js'
import { tr } from '../../i18n/index.jsx'

export default function CourseAssessments({ course }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [formCfg, setFormCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data, loading, error, reload } = useApi(() => api(`/assessments?course_id=${course.id}`), [course.id])

  const lessonOptions = course.units.flatMap((u) =>
    u.lessons.map((l) => ({ value: l.id, label: `${u.name} — ${l.title}` })),
  )

  function openCreate() {
    setFormCfg(newCfg({
      title: tr("إضافة اختبار"),
      note: tr("بعد الإنشاء هتضيف الأسئلة في الصفحة التالية."),
      fields: assessmentFields(lessonOptions),
      initial: ASSESSMENT_DEFAULTS,
      onSubmit: async (v) => {
        const created = await api('/assessments', {
          method: 'POST', body: { course_id: course.id, ...assessmentBody(v) },
        })
        toast.success(tr("تم إنشاء الاختبار. أضف الأسئلة الآن."))
        navigate(`/academy/assessments/${created.id}`)
      },
    }))
  }

  async function openEdit(a) {
    try {
      const d = await api(`/assessments/${a.id}`)
      setFormCfg(newCfg({
        title: tr("تعديل إعدادات الاختبار"),
        fields: assessmentFields(lessonOptions),
        initial: d,
        onSubmit: async (v) => {
          await api(`/assessments/${a.id}`, { method: 'PATCH', body: assessmentBody(v) })
          toast.success(tr("تم حفظ التعديلات"))
          reload()
        },
      }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openDelete(a) {
    setConfirmCfg(newCfg({
      title: tr("حذف الاختبار"),
      message: tr("هل تريد حذف الاختبار «{title}»؟ سيختفي من الطلاب، لكن نتايجهم السابقة هتفضل محفوظة.", { title: a.title }),
      confirmLabel: tr("حذف"),
      danger: true,
      onConfirm: async () => {
        await api(`/assessments/${a.id}`, { method: 'DELETE' })
        toast.success(tr("تم حذف الاختبار"))
        reload()
      },
    }))
  }

  return (
    <section className="card unit-card assessments-card">
      <div className="section-head">
        <h3>{tr("الاختبارات")}</h3>
        <button className="btn btn-secondary btn-sm" type="button" onClick={openCreate}>
          <Icon name="plus" size={16} />{' '}{tr("اختبار")}</button>
      </div>

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && data.length === 0 && <p className="muted">{tr("لا توجد اختبارات لهذا الكورس بعد.")}</p>}
        {data && data.length > 0 && (
          <div className="lessons">
            {data.map((a) => (
              <div className="tree-row" key={a.id}>
                <span className="lesson-title">
                  {a.title}
                  <span className="badge badge-muted">{KIND_LABELS[a.kind]}</span>
                  <span className="chip">{a.question_count}{' '}{tr("سؤال")}</span>
                  {a.attempts_count > 0 && <span className="chip">{a.attempts_count}{' '}{tr("محاولة")}</span>}
                  <span className={`badge ${a.is_published ? 'badge-ok' : 'badge-muted'}`}>
                    {a.is_published ? tr("منشور") : tr("مسودة")}
                  </span>
                </span>
                <div className="row-actions">
                  <Link className="btn btn-secondary btn-sm" to={`/academy/assessments/${a.id}`}>{tr("الأسئلة والنتائج")}</Link>
                  <button className="icon-btn sm" type="button" title={tr("تعديل الإعدادات")} aria-label={tr("تعديل الإعدادات")} onClick={() => openEdit(a)}>
                    <Icon name="edit" size={16} />
                  </button>
                  <button className="icon-btn sm" type="button" title={tr("حذف الاختبار")} aria-label={tr("حذف الاختبار")} onClick={() => openDelete(a)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AsyncBlock>

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </section>
  )
}
