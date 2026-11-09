import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Icon from '../../components/Icon.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import Skeleton from '../../components/Skeleton.jsx'
import StatCard from '../../components/StatCard.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'
import { tr } from '../../i18n/index.jsx'

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'student.greeting.morning'
  if (h < 18) return 'student.greeting.afternoon'
  return 'student.greeting.evening'
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="dash-hero"><Skeleton w="45%" h={30} /><div style={{ height: 12 }} /><Skeleton w="30%" h={16} /></div>
      <div className="stat-tiles">
        {[0, 1, 2, 3].map((i) => <div className="card stat-tile" key={i}><Skeleton h={46} /></div>)}
      </div>
      <div className="continue-grid">
        {[0, 1].map((i) => <div className="card continue-card" key={i}><Skeleton h={22} w="70%" /><Skeleton h={10} /><Skeleton h={48} /></div>)}
      </div>
    </div>
  )
}

export default function StudentHome() {
  const { user } = useAuth()
  const { t, fmtDate, dir } = useI18n()
  const { data, loading, error, reload } = useApi(() => api('/student/dashboard'), [])

  if (loading && !data) return <DashboardSkeleton />
  if (error) {
    return (
      <div className="card empty-block">
        <div className="alert alert-danger" role="alert">{error}</div>
        <button className="btn btn-ghost" type="button" onClick={reload}>{t('common.retry')}</button>
      </div>
    )
  }
  if (!data) return null

  const firstName = user.full_name.split(' ')[0]
  const percent = data.total_lessons ? Math.round((data.completed_lessons * 100) / data.total_lessons) : 0
  const forward = dir === 'rtl' ? 'chevronLeft' : 'chevronRight'
  const avg = data.stats.average_percentage

  return (
    <>
      <section className="dash-hero">
        <h1>{t(greetingKey())}{tr("،")}{' '}{firstName}</h1>
        <div className="hero-pills">
          {data.grade && <span className="hero-pill">{data.grade.name}</span>}
          {data.year && <span className="hero-pill">{t('student.year', { year: data.year })}</span>}
        </div>
        {data.total_lessons > 0 && (
          <div className="hero-progress">
            <ProgressBar done={data.completed_lessons} total={data.total_lessons} />
            <small>{t('student.progressLine', { done: data.completed_lessons, total: data.total_lessons, percent })}</small>
          </div>
        )}
      </section>

      {!data.grade ? (
        <EmptyState icon="academy" title={t('student.noGrade.title')} text={t('student.noGrade.text')} />
      ) : data.courses.length === 0 ? (
        <EmptyState icon="book" title={t('student.noCourses.title')} text={t('student.noCourses.text')} />
      ) : (
        <>
          <div className="stat-tiles">
            <StatCard icon="book" tone="navy" label={t('student.stat.courses')} value={data.courses.length} />
            <StatCard icon="check" tone="green" label={t('student.stat.lessons')} value={`${data.completed_lessons}/${data.total_lessons}`} />
            <StatCard icon="chart" tone="gold" label={t('student.stat.average')} value={avg !== null ? `${avg}%` : '—'} />
            <StatCard icon="audit" tone="blue" label={t('student.stat.todo')} value={data.assessments_todo.length} />
          </div>

          {data.continue_items.length > 0 && (
            <>
              <div className="section-row"><h2>{t('student.continue')}</h2></div>
              <div className="continue-grid">
                {data.continue_items.map((c) => (
                  <Link className="card continue-card" key={c.course_id} to={`/learn/lessons/${c.lesson_id}`}>
                    <div className="course-tags">
                      <span className="chip">{c.subject_name}</span>
                      <span className="badge badge-muted">{c.term_name}</span>
                    </div>
                    <h3>{c.course_name}</h3>
                    <div>
                      <ProgressBar done={c.completed_lessons} total={c.total_lessons} />
                      <div className="progress-meta">
                        <span>{t('student.lessonsCount', { done: c.completed_lessons, total: c.total_lessons })}</span>
                      </div>
                    </div>
                    <div className="continue-next">
                      <Icon name="play" size={20} />
                      <div>
                        <small>{t('student.nextLesson')}</small>
                        <strong>{c.lesson_title}</strong>
                      </div>
                    </div>
                    <span className="continue-cta">
                      {c.started ? t('student.resume') : t('student.start')} <Icon name={forward} size={16} />
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="section-row"><h2>{t('student.courses')}</h2></div>
          <div className="course-grid">
            {data.courses.map((c) => (
              <Link className="card course-card" key={c.id} to={`/learn/courses/${c.id}`}>
                <div className="course-tags">
                  <span className="chip">{c.subject_name}</span>
                  <span className="badge badge-muted">{c.term_name}</span>
                </div>
                <h3>{c.name}</h3>
                {c.description && <p className="muted clamp-2">{c.description}</p>}
                <div className="course-progress">
                  <ProgressBar done={c.completed_lessons} total={c.total_lessons} />
                  <div className="progress-meta">
                    <span>{t('student.lessonsCount', { done: c.completed_lessons, total: c.total_lessons })}</span>
                    <strong className="course-cta">
                      {c.total_lessons === 0 ? t('student.soon') : c.completed_lessons >= c.total_lessons ? t('student.review') : t('student.open')}
                    </strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="section-row"><h2>{t('student.todo.title')}</h2></div>
          <div className="dash-columns">
            <section className="card list-card">
              {data.assessments_todo.length === 0 ? (
                <div className="empty-block"><p>{t('student.todo.empty')}</p></div>
              ) : (
                data.assessments_todo.map((a) => (
                  <Link className="list-row" key={a.id} to={`/learn/assessments/${a.id}`}>
                    <div>
                      <div className="list-title">{a.title}</div>
                      <div className="list-meta">
                        {a.course_name} · {t('student.todo.questions', { n: a.question_count })}
                        {a.time_limit_minutes ? ` · ${t('student.todo.minutes', { n: a.time_limit_minutes })}` : ''}
                        {' · '}{t('student.todo.attempts', { used: a.attempts_used, max: a.max_attempts })}
                      </div>
                    </div>
                    <span className="badge badge-gold">{a.has_open_attempt ? t('student.todo.resume') : t('student.todo.begin')}</span>
                  </Link>
                ))
              )}
            </section>

            <section className="card list-card">
              {data.recent_results.length === 0 ? (
                <div className="empty-block"><p>{t('student.results.empty')}</p></div>
              ) : (
                <>
                  {data.recent_results.map((r) => (
                    <Link className="list-row" key={r.attempt_id} to={`/learn/attempts/${r.attempt_id}`}>
                      <div>
                        <div className="list-title">{r.assessment_title}</div>
                        <div className="list-meta">
                          {r.course_name} · {t('student.results.attempt', { n: r.attempt_number })} · {fmtDate(r.submitted_at)}
                        </div>
                      </div>
                      <span className={`score-pill ${r.is_passed ? 'ok' : 'bad'}`}>{r.percentage}%</span>
                    </Link>
                  ))}
                  <div className="list-row"><Link className="section-link" to="/results">{t('student.results.all')}</Link></div>
                </>
              )}
            </section>
          </div>

          <div className="section-row"><h2>{t('student.recent.title')}</h2></div>
          <section className="card list-card">
            {data.recent_lessons.length === 0 ? (
              <div className="empty-block"><p>{t('student.recent.empty')}</p></div>
            ) : (
              data.recent_lessons.map((l) => (
                <Link className="list-row" key={`${l.lesson_id}-${l.completed_at}`} to={`/learn/lessons/${l.lesson_id}`}>
                  <div>
                    <div className="list-title">{l.lesson_title}</div>
                    <div className="list-meta">{l.course_name}</div>
                  </div>
                  <span className="list-meta">{fmtDate(l.completed_at)}</span>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </>
  )
}
