import { useState } from 'react'
import Modal from './Modal.jsx'
import { generatePassword } from '../utils/password.js'
import { tr } from '../i18n/index.jsx'

/*
  config = {
    _id, title, submitLabel, note,
    fields: [{ name, label, type, required, options, ltr, help, rows, min, generate }],
    initial: { ... },
    onSubmit: async (values) => {...}   // لو رمت خطأ بيظهر جوه النافذة
  }
  types: text | email | url | number | textarea | select | checkbox
*/
export default function FormModal({ config, onClose }) {
  if (!config) return null
  return <FormBody key={config._id} config={config} onClose={onClose} />
}

function FormBody({ config, onClose }) {
  const { title, fields, initial = {}, submitLabel = tr("حفظ"), onSubmit, note } = config

  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [f.name, initial[f.name] ?? (f.type === 'checkbox' ? false : '')]),
    ),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))
  // الحقول الشرطية: بتظهر بس لما showIf ترجّع true
  const visible = fields.filter((f) => !f.showIf || f.showIf(values))

  async function submit(e) {
    e.preventDefault()
    setError('')

    for (const f of visible) {
      const v = values[f.name]
      if (f.required && (v === '' || v === null || v === undefined)) {
        setError(tr("حقل «{label}» مطلوب.", { label: f.label }))
        return
      }
    }

    const out = {}
    for (const f of visible) {
      let v = values[f.name]
      if (f.type === 'number') {
        v = v === '' ? undefined : Number(v) // الفاضي بيتشال من الطلب
      } else if (typeof v === 'string') {
        v = v.trim()
        if (v === '' && !f.required) v = null
      }
      out[f.name] = v
    }

    setBusy(true)
    try {
      await onSubmit(out)
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function renderField(f, index) {
    const id = `f_${f.name}`
    const value = values[f.name]

    if (f.type === 'checkbox') {
      return (
        <label key={f.name} className="check">
          <input type="checkbox" checked={!!value} onChange={(e) => set(f.name, e.target.checked)} />
          {f.label}
        </label>
      )
    }

    let control
    if (f.type === 'textarea') {
      control = (
        <textarea id={id} className={`input${f.ltr ? ' ltr' : ''}`} rows={f.rows || 4} value={value}
                  onChange={(e) => set(f.name, e.target.value)} autoFocus={index === 0} />
      )
    } else if (f.type === 'select') {
      control = (
        <select id={id} className="input" value={value} onChange={(e) => set(f.name, e.target.value)}>
          <option value="">{tr("اختر...")}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    } else if (f.generate) {
      control = (
        <div className="input-wrap">
          <input id={id} className="input ltr with-gen" type="text" value={value}
                 onChange={(e) => set(f.name, e.target.value)} autoComplete="off" />
          <button type="button" className="btn btn-ghost btn-sm gen-btn"
                  onClick={() => set(f.name, generatePassword())}>{tr("توليد")}</button>
        </div>
      )
    } else {
      control = (
        <input id={id} className={`input${f.ltr ? ' ltr' : ''}`}
               type={['email', 'url', 'number'].includes(f.type) ? f.type : 'text'}
               min={f.min} value={value} onChange={(e) => set(f.name, e.target.value)}
               autoFocus={index === 0} autoComplete="off" />
      )
    }

    return (
      <div key={f.name} className="field">
        <label htmlFor={id}>
          {f.label}
          {f.required && <span className="req"> *</span>}
        </label>
        {control}
        {f.help && <small className="help">{f.help}</small>}
      </div>
    )
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>{tr("إلغاء")}</button>
          <button className="btn btn-primary" type="submit" form="form-modal" disabled={busy}>
            {busy ? tr("جاري الحفظ...") : submitLabel}
          </button>
        </>
      }
    >
      <form id="form-modal" onSubmit={submit} noValidate>
        {note && <p className="muted">{note}</p>}
        {visible.map(renderField)}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
      </form>
    </Modal>
  )
}
