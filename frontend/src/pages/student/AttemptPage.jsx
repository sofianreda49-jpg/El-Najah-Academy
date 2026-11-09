import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import StatCard from '../../components/StatCard.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'
import { newCfg } from '../../utils/ids.js'

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

export default function AttemptPage() {
  const { attemptId } = useParams()
  const { data, loading, error, reload } = useApi(() => api(`/student/attempts/${attemptId}`), [attemptId])

  return (
    <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
      {data && (data.status === 'in_progress'
        ? <TakeView key={data.id} data={data} onDone={reload} />
        : <ResultView key={data.id} data={data} />)}
    </AsyncBlock>
  )
}

/* ------------------------------------------------------------ الحل: سؤال بسؤال مع خريطة الأسئلة */
function TakeView({ data, onDone }) {
  const toast = useToast()
  const { t, dir } = useI18n()
  const storageKey = `najah_attempt_${data.id}`

  // الإجابات بتتحفظ في sessionStorage علشان لو الصفحة اتعملها refresh ما تضيعش
  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || '{}')
    } catch {
      return {}
    }
  })
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirmCfg, setConfirmCfg] = useState(null)
  const submittedRef = useRef(false)

  // الوقت بيتحسب بساعة السيرفر (فرق الساعة بين الجهاز والسيرفر)
  const offsetRef = useRef(new Date(data.server_time).getTime() - Date.now())
  const deadline = data.deadline_at ? new Date(data.deadline_at).getTime() : null
  const secondsLeft = () => Math.max(0, Math.floor((deadline - (Date.now() + offsetRef.current)) / 1000))
  const [remaining, setRemaining] = useState(deadline ? secondsLeft() : null)

  useEffect(() => {
    if (deadline === null) return undefined
    const timer = setInterval(() => setRemaining(secondsLeft()), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) submit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  function choose(questionId, choiceId) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: choiceId }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function submit(auto = false) {
    if (submittedRef.current) return
    submittedRef.current = true
    setBusy(true)
    try {
      await api(`/student/attempts/${data.id}/submit`, {
        method: 'POST',
        body: { answers: data.questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] ?? null })) },
      })
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* ignore */
      }
      if (auto) toast.error(t('exam.timeUp'))
      onDone()
    } catch (err) {
      if (err.status === 409) {
        onDone() // اتسلّمت قبل كده: نعرض النتيجة
        return
      }
      submittedRef.current = false
      setBusy(false)
      toast.error(err.message)
    }
  }

  const total = data.questions.length
  const answered = data.questions.filter((q) => answers[q.id] != null).length
  const q = data.questions[index]
  const prevIcon = dir === 'rtl' ? 'chevronRight' : 'chevronLeft'
  const nextIcon = dir === 'rtl' ? 'chevronLeft' : 'chevronRight'

  function askSubmit() {
    const missing = total - answered
    setConfirmCfg(newCfg({
      title: t('exam.confirm.title'),
      message: missing > 0 ? t('exam.confirm.missing', { n: missing }) : t('exam.confirm.all'),
      confirmLabel: t('exam.confirm.ok'),
      onConfirm: () => submit(false),
    }))
  }

  return (
    <>
      <div className="attempt-bar">
        <div className="attempt-info">
          <strong>{data.assessment_title}</strong>
          <div className="muted">{t('exam.answeredOf', { a: answered, t: total })}</div>
        </div>
        {remaining !== null && (
          <div className={`timer${remaining <= 60 ? ' urgent' : ''}`} role="timer" aria-label={t('exam.timeLeft')}>
            ⏱️ {mmss(remaining)}
          </div>
        )}
      </div>
      <ProgressBar done={answered} total={total} />

      <div className="exam-layout">
        <div>
          <section className="card take-question" key={q.id}>
            <div className="question-head">
              <span className="q-num">{index + 1}</span>
              <div className="q-text">{q.text}</div>
              <span className="chip">{t('exam.points', { n: q.points })}</span>
            </div>
            <div className="take-choices" role="radiogroup" aria-label={t('exam.question', { n: index + 1 })}>
              {q.choices.map((c) => (
                <label key={c.id} className={`take-choice${answers[q.id] === c.id ? ' selected' : ''}`}>
                  <input type="radio" name={`q_${q.id}`} checked={answers[q.id] === c.id}
                         onChange={() => choose(q.id, c.id)} disabled={busy} />
                  <span>{c.text}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="exam-nav">
            <button className="btn btn-ghost" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <Icon name={prevIcon} size={16} /> {t('exam.prevQ')}
            </button>
            {index < total - 1 ? (
              <button className="btn btn-primary" type="button" onClick={() => setIndex(index + 1)}>
                {t('exam.nextQ')} <Icon name={nextIcon} size={16} />
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={askSubmit} disabled={busy}>
                <Icon name="check" size={18} /> {busy ? t('exam.submitting') : t('exam.submit')}
              </button>
            )}
          </div>
        </div>

        <aside className="card exam-side">
          <strong>{t('exam.navigator')}</strong>
          <div className="qnav-grid">
            {data.questions.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`qnav${i === index ? ' current' : ''}${answers[item.id] != null ? ' answered' : ''}`}
                aria-label={`${t('exam.question', { n: i + 1 })}${answers[item.id] != null ? ` (${t('exam.legend.answered')})` : ''}`}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="qnav-legend">
            <span><i className="dot a" />{t('exam.legend.answered')}</span>
            <span><i className="dot none" />{t('exam.legend.unanswered')}</span>
          </div>
          <p className="muted">{answered === total ? t('exam.allAnswered') : t('exam.remaining', { n: total - answered })}</p>
          <button className="btn btn-primary btn-block" type="button" onClick={askSubmit} disabled={busy}>
            <Icon name="check" size={18} /> {busy ? t('exam.submitting') : t('exam.submit')}
          </button>
        </aside>
      </div>

      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  )
}

/* ------------------------------------------------------------ النتيجة */
function ResultView({ data }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all') // all | wrong

  const tone = data.is_full_mark ? 'gold' : data.is_passed ? 'ok' : 'bad'
  const emoji = data.is_full_mark ? '🏆' : data.is_passed ? '🎉' : '💪'
  const heading = data.is_full_mark ? t('exam.result.full') : data.is_passed ? t('exam.result.pass') : t('exam.result.fail')

  const review = data.review || []
  const correct = review.filter((q) => q.is_correct).length
  const skipped = review.filter((q) => !q.answered).length
  const wrong = review.length - correct - skipped
  const shown = filter === 'wrong' ? review.filter((q) => !q.is_correct) : review

  async function retry() {
    setBusy(true)
    try {
      const attempt = await api(`/student/assessments/${data.assessment_id}/start`, { method: 'POST' })
      navigate(`/learn/attempts/${attempt.id}`)
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <section className={`card result-hero result-${tone}`}>
        <div className={`score-ring ${tone}`} style={{ '--p': Math.min(100, Math.max(0, data.percentage)) }}>
          <span>{data.percentage}%</span>
        </div>
        <div className="result-emoji" aria-hidden="true">{emoji}</div>
        <h2>{heading}</h2>
        {data.status === 'expired' && <p className="muted">{t('exam.result.expired')}</p>}
        <div className="result-score"><strong>{data.score} / {data.max_score}</strong></div>
        <p className="muted">{t('exam.result.meta', { n: data.attempt_number, p: data.passing_score })}</p>
        <div className="result-actions">
          {data.can_retry && (
            <button className="btn btn-primary" type="button" onClick={retry} disabled={busy}>
              {busy ? t('exam.loading') : t('exam.retry')}
            </button>
          )}
          <Link className="btn btn-ghost" to={`/learn/courses/${data.course_id}`}>{t('exam.toCourse')}</Link>
          <Link className="btn btn-ghost" to="/results">{t('exam.allResults')}</Link>
        </div>
      </section>

      {data.review ? (
        <>
          <div className="stat-tiles stat-tiles-3">
            <StatCard icon="check" tone="green" label={t('exam.stat.correct')} value={correct} />
            <StatCard icon="close" tone="gold" label={t('exam.stat.wrong')} value={wrong} />
            <StatCard icon="clock" tone="navy" label={t('exam.stat.skipped')} value={skipped} />
          </div>

          <div className="section-row">
            <h2>{t('exam.review')}</h2>
            <div className="review-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={filter === 'all'}
                      className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                {t('exam.review.all')}
              </button>
              <button type="button" role="tab" aria-selected={filter === 'wrong'}
                      className={filter === 'wrong' ? 'active' : ''} onClick={() => setFilter('wrong')}>
                {t('exam.review.wrong')}
              </button>
            </div>
          </div>

          {shown.length === 0 && <div className="card empty-block"><p>{t('exam.review.empty')}</p></div>}

          <div className="units">
            {shown.map((q) => (
              <section className="card take-question" key={q.id}>
                <div className="question-head">
                  <span className={`q-num ${q.is_correct ? 'ok' : 'bad'}`}>{review.indexOf(q) + 1}</span>
                  <div className="q-text">{q.text}</div>
                  <span className={`badge ${q.is_correct ? 'badge-ok' : 'badge-bad'}`}>{q.earned} / {q.points}</span>
                </div>
                <div className="take-choices">
                  {q.choices.map((c) => {
                    let cls = 'review-choice'
                    if (c.is_correct) cls += ' correct'
                    else if (c.selected) cls += ' wrong'
                    return (
                      <div key={c.id} className={cls}>
                        <span>{c.text}</span>
                        {c.selected && <small>{t('exam.yourAnswer')}</small>}
                        {c.is_correct && !c.selected && <small>{t('exam.correctAnswer')}</small>}
                      </div>
                    )
                  })}
                </div>
                {!q.answered && <p className="muted">{t('exam.notAnswered')}</p>}
                {q.explanation && <p className="explanation">💡 {q.explanation}</p>}
              </section>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">{t('exam.noReview')}</p>
      )}
    </>
  )
}
