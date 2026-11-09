import { useEffect, useState } from 'react'

import { api } from '../api/client.js'
import { useAcademyRefs } from '../hooks/useAcademyRefs.js'
import { useApi } from '../hooks/useApi.js'
import AsyncBlock from './AsyncBlock.jsx'
import Modal from './Modal.jsx'
import { useToast } from './Toast.jsx'
import { tr } from '../i18n/index.jsx'

/* تحديد الكورسات اللي المعلم مسؤول عنها. الحفظ بيستبدل القايمة كلها. */
export default function TeacherCoursesModal({ teacher, onClose }) {
  const toast = useToast()
  const { refs, error: refsError } = useAcademyRefs()
  const courses = useApi(() => api('/academy/courses'), [])
  const assigned = useApi(() => api(`/teachers/${teacher.id}/courses`), [teacher.id])

  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (assigned.data && selected === null) setSelected(new Set(assigned.data))
  }, [assigned.data, selected])

  const ready = courses.data && refs && selected
  const label = (c) => `${refs.gradeName(c.grade_id)} · ${refs.termLabel(c.term_id)} · ${refs.subjectName(c.subject_id)}`

  const visible = ready
    ? courses.data.filter((c) => `${c.name} ${label(c)}`.includes(filter.trim()))
    : []

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setBusy(true)
    try {
      await api(`/teachers/${teacher.id}/courses`, { method: 'PUT', body: { course_ids: [...selected] } })
      toast.success(tr("تم حفظ كورسات المعلم"))
      onClose()
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal wide title={tr("كورسات المعلم: {full_name}", { full_name: teacher.full_name })} onClose={busy ? () => {} : onClose}
           footer={
             <>
               <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>{tr("إلغاء")}</button>
               <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !ready}>
                 {busy ? tr("جاري الحفظ...") : tr("حفظ ({v0})", { v0: selected ? selected.size : 0 })}
               </button>
             </>
           }>
      <AsyncBlock data={ready ? true : null} loading={!ready && !courses.error && !assigned.error && !refsError}
                  error={courses.error || assigned.error || refsError}>
        {ready && (
          <>
            <p className="muted">{tr("اختار الكورسات اللي هيتابعها المعلم (طلابها ونتايجها).")}</p>
            <input className="input" type="search" placeholder={tr("ابحث باسم الكورس أو الصف أو المادة...")}
                   value={filter} onChange={(e) => setFilter(e.target.value)} />
            {courses.data.length === 0 && <p className="muted">{tr("لا توجد كورسات بعد. أضف كورساً من الأكاديمية أولاً.")}</p>}
            <div className="picker-list">
              {visible.map((c) => (
                <label key={c.id} className={`picker-row${selected.has(c.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span>
                    <strong>{c.name}</strong>
                    <small className="muted">{label(c)}</small>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </AsyncBlock>
    </Modal>
  )
}
