import { useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import FormModal from '../../components/FormModal.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useAcademyRefs } from '../../hooks/useAcademyRefs.js'
import { useApi } from '../../hooks/useApi.js'
import { newCfg } from '../../utils/ids.js'
import { tr } from '../../i18n/index.jsx'

export default function CoursesTab() {
  const toast = useToast()
  const { refs, loading: refsLoading, error: refsError, reload: reloadRefs } = useAcademyRefs()

  const [gradeId, setGradeId] = useState('')
  const [termId, setTermId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [formCfg, setFormCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data: courses, loading, error, reload } = useApi(() => {
    const params = new URLSearchParams()
    if (gradeId) params.set('grade_id', gradeId)
    if (termId) params.set('term_id', termId)
    if (subjectId) params.set('subject_id', subjectId)
    return api(`/academy/courses?${params}`)
  }, [gradeId, termId, subjectId])

  const gradeOptions = refs ? refs.grades.map((g) => ({ value: g.id, label: g.name })) : []
  const termOptions = refs ? refs.terms.map((t) => ({ value: t.id, label: refs.termLabel(t.id) })) : []
  const subjectOptions = refs ? refs.subjects.map((s) => ({ value: s.id, label: s.name })) : []

  const courseFields = [
    { name: 'grade_id', label: tr("الصف"), type: 'select', required: true, options: gradeOptions },
    { name: 'term_id', label: tr("الترم"), type: 'select', required: true, options: termOptions },
    { name: 'subject_id', label: tr("المادة"), type: 'select', required: true, options: subjectOptions },
    { name: 'name', label: tr("اسم الكورس"), required: true },
    { name: 'description', label: tr("وصف مختصر"), type: 'textarea', rows: 3 },
    {
      name: 'access', label: tr("مين يقدر يشوف الكورس؟"), type: 'select', required: true,
      options: [
        { value: 'grade', label: tr("كل طلاب الصف") },
        { value: 'enrolled', label: tr("الطلاب اللي أضيفهم بنفسي فقط") },
      ],
    },
    { name: 'is_published', label: tr("منشور (ظاهر للطلاب)"), type: 'checkbox' },
  ]

  function openCreate() {
    setFormCfg(newCfg({
      title: tr("إضافة كورس"),
      fields: courseFields,
      initial: { grade_id: gradeId, term_id: termId, subject_id: subjectId, is_published: false, access: 'grade' },
      onSubmit: async (v) => {
        await api('/academy/courses', {
          method: 'POST',
          body: { ...v, grade_id: Number(v.grade_id), term_id: Number(v.term_id), subject_id: Number(v.subject_id) },
        })
        toast.success(tr("تمت إضافة الكورس"))
        reload()
      },
    }))
  }

  function openEdit(c) {
    setFormCfg(newCfg({
      title: tr("تعديل الكورس"),
      fields: courseFields,
      initial: c,
      onSubmit: async (v) => {
        await api(`/academy/courses/${c.id}`, {
          method: 'PATCH',
          body: { ...v, grade_id: Number(v.grade_id), term_id: Number(v.term_id), subject_id: Number(v.subject_id) },
        })
        toast.success(tr("تم حفظ التعديلات"))
        reload()
      },
    }))
  }

  function openDelete(c) {
    setConfirmCfg(newCfg({
      title: tr("حذف الكورس"),
      message: tr("هل تريد حذف الكورس «{name}»؟", { name: c.name }),
      confirmLabel: tr("حذف"),
      danger: true,
      onConfirm: async () => {
        await api(`/academy/courses/${c.id}`, { method: 'DELETE' })
        toast.success(tr("تم حذف الكورس"))
        reload()
      },
    }))
  }

  return (
    <AsyncBlock data={refs} loading={refsLoading} error={refsError} onRetry={reloadRefs}>
      {refs && (
        <>
          <div className="toolbar">
            <select className="input toolbar-select" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">{tr("كل الصفوف")}</option>
              {gradeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input toolbar-select" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">{tr("كل الأترام")}</option>
              {termOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input toolbar-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">{tr("كل المواد")}</option>
              {subjectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="btn btn-primary toolbar-end" type="button" onClick={openCreate}>
              <Icon name="plus" size={18} />{' '}{tr("إضافة كورس")}</button>
          </div>

          <div className="card">
            <AsyncBlock data={courses} loading={loading} error={error} onRetry={reload}>
              {courses && courses.length === 0 ? (
                <div className="empty-state">
                  <h2>{tr("لا توجد كورسات")}</h2>
                  <p className="muted">{tr("أضف أول كورس، أو غيّر الفلتر.")}</p>
                </div>
              ) : (
                courses && (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>{tr("الكورس")}</th><th>{tr("الصف")}</th><th>{tr("الترم")}</th><th>{tr("المادة")}</th><th>{tr("الحالة")}</th><th /></tr>
                      </thead>
                      <tbody>
                        {courses.map((c) => (
                          <tr key={c.id}>
                            <td><strong>{c.name}</strong></td>
                            <td>{refs.gradeName(c.grade_id)}</td>
                            <td>{refs.termLabel(c.term_id)}</td>
                            <td>{refs.subjectName(c.subject_id)}</td>
                            <td>
                              <span className={`badge ${c.is_published ? 'badge-ok' : 'badge-muted'}`}>
                                {c.is_published ? tr("منشور") : tr("مسودة")}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <Link className="btn btn-secondary btn-sm" to={`/academy/courses/${c.id}`}>
                                  <Icon name="folder" size={16} />{' '}{tr("المحتوى")}</Link>
                                <button className="icon-btn" type="button" title={tr("تعديل")} aria-label={tr("تعديل")}
                                        onClick={() => openEdit(c)}>
                                  <Icon name="edit" size={18} />
                                </button>
                                <button className="icon-btn" type="button" title={tr("حذف")} aria-label={tr("حذف")}
                                        onClick={() => openDelete(c)}>
                                  <Icon name="trash" size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </AsyncBlock>
          </div>
        </>
      )}

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </AsyncBlock>
  )
}
