import { useState } from 'react'

import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import { tr } from '../i18n/index.jsx'

const TF = [
  { get text() { return tr("صح") }, is_correct: true },
  { get text() { return tr("خطأ") }, is_correct: false },
]
export const blankChoices = (n = 4) => Array.from({ length: n }, (_, i) => ({ text: '', is_correct: i === 0 }))
export const newQuestion = () => ({ kind: 'mcq', text: '', explanation: '', points: 1, choices: blankChoices() })

/* config = { _id, title, initial: { kind, text, explanation, points, choices }, onSubmit: async (payload) => {} } */
export default function QuestionModal({ config, onClose }) {
  if (!config) return null
  return <QuestionBody key={config._id} config={config} onClose={onClose} />
}

function QuestionBody({ config, onClose }) {
  const { initial } = config
  const [kind, setKind] = useState(initial.kind)
  const [text, setText] = useState(initial.text)
  const [explanation, setExplanation] = useState(initial.explanation || '')
  const [points, setPoints] = useState(initial.points)
  const [choices, setChoices] = useState(initial.choices.map((c) => ({ ...c })))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isTF = kind === 'true_false'

  function changeKind(next) {
    setKind(next)
    if (next === 'true_false') {
      setChoices(TF.map((c) => ({ ...c })))
    } else if (choices.length === 2 && choices[0].text === tr("صح") && choices[1].text === tr("خطأ")) {
      setChoices(blankChoices())
    }
  }

  const setChoiceText = (i, t) => setChoices((cs) => cs.map((c, idx) => (idx === i ? { ...c, text: t } : c)))
  const setCorrect = (i) => setChoices((cs) => cs.map((c, idx) => ({ ...c, is_correct: idx === i })))
  const addChoice = () => setChoices((cs) => [...cs, { text: '', is_correct: false }])
  const removeChoice = (i) =>
    setChoices((cs) => {
      const next = cs.filter((_, idx) => idx !== i)
      return next.some((c) => c.is_correct) ? next : next.map((c, idx) => (idx === 0 ? { ...c, is_correct: true } : c))
    })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (text.trim().length < 2) return setError(tr("اكتب نص السؤال."))
    if (!isTF && choices.some((c) => !c.text.trim())) return setError(tr("املأ كل الاختيارات أو احذف الفاضي منها."))
    if (!choices.some((c) => c.is_correct)) return setError(tr("حدد الإجابة الصحيحة."))
    const texts = choices.map((c) => c.text.trim())
    if (new Set(texts).size !== texts.length) return setError(tr("الاختيارات لازم تكون مختلفة عن بعضها."))

    setBusy(true)
    try {
      await config.onSubmit({
        kind,
        text: text.trim(),
        explanation: explanation.trim() || null,
        points: Number(points) || 1,
        choices: choices.map((c) => ({ text: c.text.trim(), is_correct: c.is_correct })),
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={config.title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>{tr("إلغاء")}</button>
          <button className="btn btn-primary" type="submit" form="question-form" disabled={busy}>
            {busy ? tr("جاري الحفظ...") : tr("حفظ السؤال")}
          </button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="q-kind">{tr("نوع السؤال")}</label>
          <select id="q-kind" className="input" value={kind} onChange={(e) => changeKind(e.target.value)}>
            <option value="mcq">{tr("اختيار من متعدد")}</option>
            <option value="true_false">{tr("صح أو خطأ")}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="q-text">{tr("نص السؤال")}{' '}<span className="req">*</span></label>
          <textarea id="q-text" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>

        <fieldset className="choices-editor">
          <legend>{tr("الاختيارات")}{' '}<span className="muted">{tr("(حدد الإجابة الصحيحة)")}</span></legend>
          {choices.map((c, i) => (
            <div className="choice-row" key={i}>
              <input type="radio" name="correct" checked={c.is_correct} onChange={() => setCorrect(i)}
                     aria-label={tr("الاختيار {v0} هو الإجابة الصحيحة", { v0: i + 1 })} />
              {isTF ? (
                <span className="choice-fixed">{c.text}</span>
              ) : (
                <input className="input" value={c.text} placeholder={tr("الاختيار {v0}", { v0: i + 1 })}
                       onChange={(e) => setChoiceText(i, e.target.value)} />
              )}
              {!isTF && choices.length > 2 && (
                <button type="button" className="icon-btn sm" onClick={() => removeChoice(i)} aria-label={tr("حذف الاختيار")}>
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>
          ))}
          {!isTF && choices.length < 6 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addChoice}>
              <Icon name="plus" size={14} />{' '}{tr("اختيار آخر")}</button>
          )}
        </fieldset>

        <div className="field">
          <label htmlFor="q-points">{tr("الدرجة")}</label>
          <input id="q-points" className="input" type="number" min="1" max="100" value={points}
                 onChange={(e) => setPoints(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="q-exp">{tr("شرح الإجابة (اختياري)")}</label>
          <textarea id="q-exp" className="input" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          <small className="help">{tr("بيظهر للطالب بعد التسليم لو إظهار الإجابات مفعّل.")}</small>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
      </form>
    </Modal>
  )
}
