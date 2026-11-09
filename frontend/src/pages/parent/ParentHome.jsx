import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import Skeleton from '../../components/Skeleton.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'
import { greetingKey } from '../../utils/greeting.js'
import { tr } from '../../i18n/index.jsx'

export default function ParentHome() {
  const { user } = useAuth()
  const { t, fmtDate } = useI18n()
  const { data, loading, error, reload } = useApi(() => api('/parent/dashboard'), [])
  const firstName = user.full_name.split(' ')[0]

  return (
    <>
      <section className="dash-hero">
        <h1>{t(greetingKey())}{tr("،")}{' '}{firstName}</h1>
        <p>{t('parent.welcome')}</p>
      </section>

      {loading && !data && (
        <div className="course-grid">
          {[0, 1].map((i) => <div className="card child-card" key={i}><Skeleton h={22} w="60%" /><Skeleton h={10} /><Skeleton h={48} /></div>)}
        </div>
      )}

      {error && (
        <div className="card empty-block">
          <div className="alert alert-danger" role="alert">{error}</div>
          <button className="btn btn-ghost" type="button" onClick={reload}>{t('common.retry')}</button>
        </div>
      )}

      {data && data.children.length === 0 && (
        <EmptyState icon="users" title={t('parent.empty.title')} text={t('parent.empty.text')} />
      )}

      {data && data.children.length > 0 && (
        <>
          <div className="section-row"><h2>{t('parent.children')}</h2></div>
          <div className="course-grid">
            {data.children.map((c) => (
              <Link className="card child-card" key={c.id} to={`/children/${c.id}`}>
                <div className="course-tags">
                  {c.grade_name
                    ? <span className="chip">{c.grade_name}</span>
                    : <span className="badge badge-bad">{t('parent.gradeUnset')}</span>}
                </div>
                <h3>{c.full_name}</h3>

                <div>
                  <ProgressBar done={c.completed_lessons} total={c.total_lessons} />
                  <div className="progress-meta">
                    <span>{t('parent.lessons', { done: c.completed_lessons, total: c.total_lessons })}</span>
                    <strong className="course-cta">{t('parent.details')}</strong>
                  </div>
                </div>

                <div className="child-meta">
                  <span>{t('parent.attempts', { n: c.attempts_count })}</span>
                  <span>{c.average_percentage !== null ? t('parent.average', { n: c.average_percentage }) : t('parent.noResults')}</span>
                </div>

                <div className="child-last">
                  {c.last_result ? (
                    <>
                      <div>
                        <small>{t('parent.lastResult')}</small>
                        <strong>{c.last_result.assessment_title}</strong>
                      </div>
                      <span className={`score-pill ${c.last_result.is_passed ? 'ok' : 'bad'}`}>{c.last_result.percentage}%</span>
                    </>
                  ) : (
                    <small>{t('parent.noResults')}</small>
                  )}
                </div>
                <div className="list-meta">
                  {c.last_activity ? t('parent.lastActivity', { date: fmtDate(c.last_activity) }) : t('parent.noActivity')}
                </div>
              </Link>
            ))}
          </div>

          <div className="section-row"><h2>{t('parent.recent.title')}</h2></div>
          <section className="card list-card">
            {data.recent_results.length === 0 ? (
              <div className="empty-block"><p>{t('parent.recent.empty')}</p></div>
            ) : (
              data.recent_results.map((r) => (
                <Link className="list-row" key={r.attempt_id} to={`/children/${r.child_id}`}>
                  <div>
                    <div className="list-title">{r.assessment_title}</div>
                    <div className="list-meta">{r.child_name} · {r.course_name} · {fmtDate(r.submitted_at)}</div>
                  </div>
                  <span className={`score-pill ${r.is_passed ? 'ok' : 'bad'}`}>{r.percentage}%</span>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </>
  )
}
