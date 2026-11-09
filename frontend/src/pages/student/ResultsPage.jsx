import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'

export default function ResultsPage() {
  const { t, fmtDate } = useI18n()
  const { data, loading, error, reload } = useApi(() => api('/student/results'), [])

  return (
    <>
      <PageHeader title={t('results.title')} subtitle={t('results.subtitle')} />
      <div className="card">
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
          {data && data.length === 0 ? (
            <div className="empty-block">
              <h3>{t('results.empty.title')}</h3>
              <p>{t('results.empty.text')}</p>
            </div>
          ) : (
            data && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('results.col.exam')}</th><th>{t('results.col.course')}</th><th>{t('exam.col.attempt')}</th>
                      <th>{t('exam.col.score')}</th><th>{t('exam.col.percent')}</th><th>{t('exam.col.result')}</th>
                      <th>{t('exam.col.date')}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r.attempt_id}>
                        <td><strong>{r.assessment_title}</strong></td>
                        <td className="muted">{r.course_name}</td>
                        <td>{r.attempt_number}</td>
                        <td>{r.score} / {r.max_score}</td>
                        <td>{r.percentage}%</td>
                        <td><span className={`badge ${r.is_passed ? 'badge-ok' : 'badge-bad'}`}>{r.is_passed ? t('common.passed') : t('exam.notPassed')}</span></td>
                        <td className="muted">{fmtDate(r.submitted_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td><Link className="btn btn-ghost btn-sm" to={`/learn/attempts/${r.attempt_id}`}>{t('exam.view')}</Link></td>
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
  )
}
