import { useState } from 'react'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import FormModal from '../../components/FormModal.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { newCfg } from '../../utils/ids.js'
import { tr } from '../../i18n/index.jsx'

const ORDER_FIELD = { name: 'order_index', get label() { return tr("الترتيب") }, type: 'number', min: 0, get help() { return tr("رقم أصغر = يظهر أولاً.") } }

export default function StructureTab() {
  const { user } = useAuth()
  const toast = useToast()
  const isOwner = user.role === 'super_admin'

  const [formCfg, setFormCfg] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)

  const { data, loading, error, reload } = useApi(async () => {
    const [stages, grades, years, terms, subjects] = await Promise.all([
      api('/academy/stages'),
      api('/academy/grades'),
      api('/academy/academic-years'),
      api('/academy/terms'),
      api('/academy/subjects'),
    ])
    return { stages, grades, years, terms, subjects }
  }, [])

  // ---- مساعدات عامة ----
  const openForm = (cfg) => setFormCfg(newCfg(cfg))

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

  const Actions = ({ onEdit, onDelete, extra }) =>
    isOwner ? (
      <div className="row-actions">
        {extra}
        <button className="icon-btn sm" type="button" title={tr("تعديل")} aria-label={tr("تعديل")} onClick={onEdit}>
          <Icon name="edit" size={16} />
        </button>
        <button className="icon-btn sm" type="button" title={tr("حذف")} aria-label={tr("حذف")} onClick={onDelete}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    ) : null

  // ---- المراحل والصفوف ----
  const stageFields = [
    { name: 'name', label: tr("اسم المرحلة"), required: true },
    { name: 'description', label: tr("وصف"), type: 'textarea', rows: 2 },
    ORDER_FIELD,
  ]
  const addStage = () => openForm({
    title: tr("إضافة مرحلة"), fields: stageFields, initial: { order_index: (data?.stages.length || 0) + 1 },
    onSubmit: (v) => save('POST', '/academy/stages', v, tr("تمت إضافة المرحلة")),
  })
  const editStage = (s) => openForm({
    title: tr("تعديل المرحلة"), fields: stageFields, initial: s,
    onSubmit: (v) => save('PATCH', `/academy/stages/${s.id}`, v, tr("تم حفظ التعديلات")),
  })

  const gradeFields = [{ name: 'name', label: tr("اسم الصف"), required: true }, ORDER_FIELD]
  const addGrade = (stage) => openForm({
    title: tr("إضافة صف في {name}", { name: stage.name }), fields: gradeFields,
    initial: { order_index: (data?.grades.filter((g) => g.stage_id === stage.id).length || 0) + 1 },
    onSubmit: (v) => save('POST', '/academy/grades', { ...v, stage_id: stage.id }, tr("تمت إضافة الصف")),
  })
  const editGrade = (g) => openForm({
    title: tr("تعديل الصف"), fields: gradeFields, initial: g,
    onSubmit: (v) => save('PATCH', `/academy/grades/${g.id}`, v, tr("تم حفظ التعديلات")),
  })

  // ---- السنوات والأترام ----
  const yearFields = [
    { name: 'name', label: tr("السنة الدراسية"), required: true, ltr: true, help: tr("بصيغة 2026/2027") },
  ]
  const addYear = () => openForm({
    title: tr("إضافة سنة دراسية"), fields: yearFields,
    onSubmit: (v) => save('POST', '/academy/academic-years', v, tr("تمت إضافة السنة الدراسية")),
  })
  const editYear = (y) => openForm({
    title: tr("تعديل السنة الدراسية"), fields: yearFields, initial: y,
    onSubmit: (v) => save('PATCH', `/academy/academic-years/${y.id}`, v, tr("تم حفظ التعديلات")),
  })
  const setCurrent = (y) => setConfirmCfg(newCfg({
    title: tr("تعيين السنة الحالية"),
    message: tr("هل تريد جعل {name} هي السنة الدراسية الحالية؟", { name: y.name }),
    confirmLabel: tr("تعيين"),
    onConfirm: async () => {
      await api(`/academy/academic-years/${y.id}/set-current`, { method: 'POST' })
      toast.success(tr("تم تعيين السنة الحالية"))
      reload()
    },
  }))

  const termFields = [{ name: 'name', label: tr("اسم الترم"), required: true }, ORDER_FIELD]
  const addTerm = (y) => openForm({
    title: tr("إضافة ترم في {name}", { name: y.name }), fields: termFields,
    initial: { order_index: (data?.terms.filter((t) => t.academic_year_id === y.id).length || 0) + 1 },
    onSubmit: (v) => save('POST', '/academy/terms', { ...v, academic_year_id: y.id }, tr("تمت إضافة الترم")),
  })
  const editTerm = (t) => openForm({
    title: tr("تعديل الترم"), fields: termFields, initial: t,
    onSubmit: (v) => save('PATCH', `/academy/terms/${t.id}`, v, tr("تم حفظ التعديلات")),
  })

  // ---- المواد ----
  const subjectFields = [
    { name: 'name', label: tr("اسم المادة"), required: true },
    { name: 'description', label: tr("وصف"), type: 'textarea', rows: 2 },
    ORDER_FIELD,
  ]
  const addSubject = () => openForm({
    title: tr("إضافة مادة"), fields: subjectFields, initial: { order_index: (data?.subjects.length || 0) + 1 },
    onSubmit: (v) => save('POST', '/academy/subjects', v, tr("تمت إضافة المادة")),
  })
  const editSubject = (s) => openForm({
    title: tr("تعديل المادة"), fields: subjectFields, initial: s,
    onSubmit: (v) => save('PATCH', `/academy/subjects/${s.id}`, v, tr("تم حفظ التعديلات")),
  })

  const AddButton = ({ onClick, children }) =>
    isOwner ? (
      <button className="btn btn-secondary btn-sm" type="button" onClick={onClick}>
        <Icon name="plus" size={16} /> {children}
      </button>
    ) : null

  return (
    <>
      {!isOwner && (
        <div className="alert alert-warn">{tr("الهيكل الأساسي للعرض فقط. تعديله من صلاحيات المالك.")}</div>
      )}

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="structure-grid">
            {/* ---------- المراحل والصفوف ---------- */}
            <section className="card">
              <div className="section-head">
                <h3>{tr("المراحل والصفوف")}</h3>
                <AddButton onClick={addStage}>{tr("مرحلة")}</AddButton>
              </div>
              {data.stages.length === 0 && <p className="muted">{tr("لا توجد مراحل بعد.")}</p>}
              {data.stages.map((s) => (
                <div className="tree-group" key={s.id}>
                  <div className="tree-row tree-parent">
                    <strong>{s.name}</strong>
                    <Actions onEdit={() => editStage(s)} onDelete={() => askDelete(tr("المرحلة"), s.name, `/academy/stages/${s.id}`)}
                             extra={isOwner && (
                               <button className="btn btn-ghost btn-sm" type="button" onClick={() => addGrade(s)}>
                                 <Icon name="plus" size={14} />{' '}{tr("صف")}</button>
                             )} />
                  </div>
                  <div className="tree-children">
                    {data.grades.filter((g) => g.stage_id === s.id).map((g) => (
                      <div className="tree-row" key={g.id}>
                        <span>{g.name}</span>
                        <Actions onEdit={() => editGrade(g)} onDelete={() => askDelete(tr("الصف"), g.name, `/academy/grades/${g.id}`)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* ---------- السنوات والأترام ---------- */}
            <section className="card">
              <div className="section-head">
                <h3>{tr("السنوات والأترام")}</h3>
                <AddButton onClick={addYear}>{tr("سنة")}</AddButton>
              </div>
              {data.years.length === 0 && <p className="muted">{tr("لا توجد سنوات دراسية بعد.")}</p>}
              {data.years.map((y) => (
                <div className="tree-group" key={y.id}>
                  <div className="tree-row tree-parent">
                    <span>
                      <strong>{y.name}</strong>
                      {y.is_current && <span className="badge badge-gold mr-6">{tr("الحالية")}</span>}
                    </span>
                    <Actions onEdit={() => editYear(y)} onDelete={() => askDelete(tr("السنة الدراسية"), y.name, `/academy/academic-years/${y.id}`)}
                             extra={isOwner && (
                               <>
                                 {!y.is_current && (
                                   <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCurrent(y)}>{tr("تعيين كحالية")}</button>
                                 )}
                                 <button className="btn btn-ghost btn-sm" type="button" onClick={() => addTerm(y)}>
                                   <Icon name="plus" size={14} />{' '}{tr("ترم")}</button>
                               </>
                             )} />
                  </div>
                  <div className="tree-children">
                    {data.terms.filter((t) => t.academic_year_id === y.id).map((t) => (
                      <div className="tree-row" key={t.id}>
                        <span>{t.name}</span>
                        <Actions onEdit={() => editTerm(t)} onDelete={() => askDelete(tr("الترم"), t.name, `/academy/terms/${t.id}`)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* ---------- المواد ---------- */}
            <section className="card">
              <div className="section-head">
                <h3>{tr("المواد")}</h3>
                <AddButton onClick={addSubject}>{tr("مادة")}</AddButton>
              </div>
              {data.subjects.length === 0 && <p className="muted">{tr("لا توجد مواد بعد.")}</p>}
              <div className="tree-children flat">
                {data.subjects.map((s) => (
                  <div className="tree-row" key={s.id}>
                    <span>{s.name}</span>
                    <Actions onEdit={() => editSubject(s)} onDelete={() => askDelete(tr("المادة"), s.name, `/academy/subjects/${s.id}`)} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </AsyncBlock>

      <FormModal config={formCfg} onClose={() => setFormCfg(null)} />
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  )
}
