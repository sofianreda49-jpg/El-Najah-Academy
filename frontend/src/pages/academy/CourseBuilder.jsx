import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import FormModal from '../../components/FormModal.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useAcademyRefs } from '../../hooks/useAcademyRefs.js'
import { useApi } from '../../hooks/useApi.js'
import CourseAssessments from './CourseAssessments.jsx'
import CourseStudents from './CourseStudents.jsx'
import { newCfg } from '../../utils/ids.js'
import { tr } from '../../i18n/index.jsx'

const ORDER_FIELD = { name: 'order_index', get label() { return tr("الترتيب") }, type: 'number', min: 0, get help() { return tr("رقم أصغر = يظهر أولاً.") } }

export default function CourseBuilder() {
  const { courseId } = useParams()
  const toast = useToast()
  const { refs } = useAcademyRefs()

  const [formCfg, setFormCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data: course, loading, error, reload } = useApi(
    () => api(`/academy/courses/${courseId}`),
    [courseId],
  )

  const save = async (method, path, body, message) => {
    await api(path, { method, body })
    toast.success(message)
    reload()
  }

  const askDelete = (label, name, path) =>
    setConfirmCfg(newCfg({
      title: tr("حذف {label}", { label }),
      message: tr("هل تريد حذف {label} «{name}»؟", { label, name }),
      confirmLabel: tr("حذف"),
      danger: true,
      onConfirm: async () => {
        await api(path, { method: 'DELETE' })
        toast.success(tr("تم حذف {label}", { label }))
        reload()
      },
    }))

  // ---- الوحدات ----
  const unitFields = [
    { name: 'name', label: tr("اسم الوحدة"), required: true },
    { name: 'description', label: tr("وصف"), type: 'textarea', rows: 2 },
    ORDER_FIELD,
  ]
  const addUnit = () => setFormCfg(newCfg({
    title: tr("إضافة وحدة"), fields: unitFields,
    initial: { order_index: (course?.units.length || 0) + 1 },
    onSubmit: (v) => save('POST', '/academy/units', { ...v, course_id: course.id }, tr("تمت إضافة الوحدة")),
  }))
  const editUnit = (u) => setFormCfg(newCfg({
    title: tr("تعديل الوحدة"), fields: unitFields, initial: u,
    onSubmit: (v) => save('PATCH', `/academy/units/${u.id}`, v, tr("تم حفظ التعديلات")),
  }))

  // ---- الدروس ----
  const lessonFields = [
    { name: 'title', label: tr("عنوان الدرس"), required: true },
    { name: 'content', label: tr("شرح الدرس"), type: 'textarea', rows: 8 },
    { name: 'video_url', label: tr("رابط الفيديو"), type: 'url', ltr: true, help: tr("رابط كامل يبدأ بـ https://") },
    { name: 'file_url', label: tr("رابط ملف مرفق (PDF مثلاً)"), type: 'url', ltr: true, help: tr("رابط كامل يبدأ بـ https://") },
    ORDER_FIELD,
    { name: 'is_published', label: tr("منشور (ظاهر للطلاب)"), type: 'checkbox' },
  ]
  const addLesson = (unit) => setFormCfg(newCfg({
    title: tr("إضافة درس في {name}", { name: unit.name }), fields: lessonFields,
    initial: { order_index: unit.lessons.length + 1, is_published: false },
    onSubmit: (v) => save('POST', '/academy/lessons', { ...v, unit_id: unit.id }, tr("تمت إضافة الدرس")),
  }))
  const editLesson = (l) => setFormCfg(newCfg({
    title: tr("تعديل الدرس"), fields: lessonFields, initial: l,
    onSubmit: (v) => save('PATCH', `/academy/lessons/${l.id}`, v, tr("تم حفظ التعديلات")),
  }))

  const togglePublish = () => save(
    'PATCH', `/academy/courses/${course.id}`, { is_published: !course.is_published },
    course.is_published ? tr("تم إلغاء نشر الكورس") : tr("تم نشر الكورس"),
  ).catch((err) => toast.error(err.message))

  return (
    <>
      <Link className="link-back" to="/academy"><Icon name="arrowRight" size={16} />{' '}{tr("الرجوع للكورسات")}</Link>

      <AsyncBlock data={course} loading={loading} error={error} onRetry={reload}>
        {course && (
          <>
            <PageHeader
              title={course.name}
              subtitle={refs ? `${refs.gradeName(course.grade_id)} · ${refs.termLabel(course.term_id)} · ${refs.subjectName(course.subject_id)}` : ''}
              actions={
                <>
                  <button className="btn btn-ghost" type="button" onClick={togglePublish}>
                    {course.is_published ? tr("إلغاء النشر") : tr("نشر الكورس")}
                  </button>
                  <button className="btn btn-primary" type="button" onClick={addUnit}>
                    <Icon name="plus" size={18} />{' '}{tr("إضافة وحدة")}</button>
                </>
              }
            />
            <p>
              <span className={`badge ${course.is_published ? 'badge-ok' : 'badge-muted'}`}>
                {course.is_published ? tr("منشور") : tr("مسودة")}
              </span>
              {course.description && <span className="muted mr-6">{course.description}</span>}
            </p>

            <CourseStudents course={course} />

            <CourseAssessments course={course} />

            {course.units.length === 0 ? (
              <div className="card empty-state">
                <h2>{tr("لا توجد وحدات بعد")}</h2>
                <p className="muted">{tr("ابدأ بإضافة أول وحدة، ثم أضف الدروس بداخلها.")}</p>
              </div>
            ) : (
              <div className="units">
                {course.units.map((u) => (
                  <section className="card unit-card" key={u.id}>
                    <div className="section-head">
                      <div>
                        <h3>{u.name}</h3>
                        {u.description && <p className="muted">{u.description}</p>}
                      </div>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => addLesson(u)}>
                          <Icon name="plus" size={16} />{' '}{tr("درس")}</button>
                        <button className="icon-btn sm" type="button" title={tr("تعديل الوحدة")} aria-label={tr("تعديل الوحدة")} onClick={() => editUnit(u)}>
                          <Icon name="edit" size={16} />
                        </button>
                        <button className="icon-btn sm" type="button" title={tr("حذف الوحدة")} aria-label={tr("حذف الوحدة")}
                                onClick={() => askDelete(tr("الوحدة"), u.name, `/academy/units/${u.id}`)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>

                    {u.lessons.length === 0 ? (
                      <p className="muted">{tr("لا توجد دروس في هذه الوحدة.")}</p>
                    ) : (
                      <div className="lessons">
                        {u.lessons.map((l) => (
                          <div className="tree-row" key={l.id}>
                            <span className="lesson-title">
                              {l.title}
                              {l.video_url && <span className="chip"><Icon name="play" size={14} />{' '}{tr("فيديو")}</span>}
                              {l.file_url && <span className="chip"><Icon name="file" size={14} />{' '}{tr("ملف")}</span>}
                              {!l.is_published && <span className="badge badge-muted">{tr("مسودة")}</span>}
                            </span>
                            <div className="row-actions">
                              <button className="icon-btn sm" type="button" title={tr("تعديل الدرس")} aria-label={tr("تعديل الدرس")} onClick={() => editLesson(l)}>
                                <Icon name="edit" size={16} />
                              </button>
                              <button className="icon-btn sm" type="button" title={tr("حذف الدرس")} aria-label={tr("حذف الدرس")}
                                      onClick={() => askDelete(tr("الدرس"), l.title, `/academy/lessons/${l.id}`)}>
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </AsyncBlock>

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  )
}
