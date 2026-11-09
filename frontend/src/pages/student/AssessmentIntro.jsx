import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import StatCard from '../../components/StatCard.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'

export default function AssessmentIntro() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { t, fmtDate, dir } = useI18n()
  const [busy, setBusy] = useState(false)
  const backIcon = dir === 'rtl' ? 'arrowRight' : 'chevronLeft'

  const { data, loading, error, reload } = useApi(() => api(`/student/assessments/${assessmentId}`), [assessmentId])

  async function start() {
    setBusy(true)
    try {
      const attempt = await api(`/student/assessments/${assessmentId}/start`, { method: 'POST' })
      navigate(`/learn/attempts/${attempt.id}`)
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
      reload()
    }
  }

  return (
    <>
      {data && (
        <Link className="link-back" to={`/learn/courses/${data.course_id}`}>
          <Icon name={backIcon} size={16} /> {t('exam.back')}
        </Link>
      )}

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (() => {
          const actionLabel = data.open_attempt_id ? t('exam.resume') : data.attempts_used === 0 ? t('exam.start') : t('exam.newAttempt')
          return (
            <>
              <PageHeader title={data.title} subtitle={data.description || ''} />

              <div className="stat-tiles">
                <StatCard icon="audit" tone="navy" label={t('exam.questions')} value={data.question_count} />
                <StatCard icon="clock" tone="gold" label={data.time_limit_minutes ? t('exam.minutes') : t('exam.noLimit')}
                          value={data.time_limit_minutes ?? '∞'} />
                <StatCard icon="trophy" tone="green" label={t('exam.passing')} value={`${data.passing_score}%`} />
                <StatCard icon="chart" tone="blue" label={t('exam.attemptsLeft')} value={Math.max(0, data.max_attempts - data.attempts_used)} />
              </div>

              <div className="card start-card">
                {data.time_limit_minutes && <p className="muted">⏱️ {t('exam.timeNote', { action: actionLabel })}</p>}
                <button className="btn btn-primary" type="button" onClick={start} disabled={busy || !data.can_start}>
                  <Icon name="play" size={18} />
                  {busy ? t('exam.loading') : actionLabel}
                </button>
                {!data.can_start && <p className="muted">{t('exam.noAttempts')}</p>}
              </div>

              {data.attempts.length > 0 && (
                <div className="card">
                  <h3 className="card-title">{t('exam.history')}</h3>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t('exam.col.attempt')}</th><th>{t('exam.col.score')}</th><th>{t('exam.col.percent')}</th>
                          <th>{t('exam.col.result')}</th><th>{t('exam.col.date')}</th><th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.attempts.map((a) => (
                          <tr key={a.id}>
                            <td>{a.attempt_number}</td>
                            <td>{a.score} / {a.max_score}</td>
                            <td>{a.percentage}%</td>
                            <td><span className={`badge ${a.is_passed ? 'badge-ok' : 'badge-bad'}`}>{a.is_passed ? t('common.passed') : t('exam.notPassed')}</span></td>
                            <td className="muted">{fmtDate(a.submitted_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                            <td><Link className="btn btn-ghost btn-sm" to={`/learn/attempts/${a.id}`}>{t('exam.view')}</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </AsyncBlock>
    </>
  )
}
