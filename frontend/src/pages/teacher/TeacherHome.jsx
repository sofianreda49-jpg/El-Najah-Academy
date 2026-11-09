import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Icon from '../../components/Icon.jsx'
import Skeleton from '../../components/Skeleton.jsx'
import StatCard from '../../components/StatCard.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'
import { greetingKey } from '../../utils/greeting.js'
import { tr } from '../../i18n/index.jsx'

export default function TeacherHome() {
  const { user } = useAuth()
  const { t, fmtDate } = useI18n()
  const courses = useApi(() => api('/teacher/courses'), [])
  const overview = useApi(() => api('/teacher/overview'), [])

  const o = overview.data
  const firstName = user.full_name.split(' ')[0]
  const loadingStats = overview.loading && !o
  const dateTime = { dateStyle: 'medium', timeStyle: 'short' }

  return (
    <>
      <section className="dash-hero">
        <h1>{t(greetingKey())}{tr("،")}{' '}{firstName}</h1>
        <p>{t('teacher.welcome')}</p>
        <div className="hero-pills">
          <Link className="btn btn-sm hero-btn" to="/academy"><Icon name="plus" size={16} /> {t('teacher.add')}</Link>
        </div>
      </section>

      <div className="stat-tiles">
        <StatCard icon="academy" tone="navy" loading={loadingStats} label={t('teacher.stat.courses')} value={o?.summary.courses} />
        <StatCard icon="users" tone="green" loading={loadingStats} label={t('teacher.stat.students')} value={o?.summary.students} />
        <StatCard icon="play" tone="gold" loading={loadingStats} label={t('teacher.stat.lessons')} value={o?.summary.published_lessons} />
        <StatCard icon="audit" tone="blue" loading={loadingStats} label={t('teacher.stat.assessments')} value={o?.summary.assessments} />
      </div>

      {courses.error && (
        <div className="card empty-block">
          <div className="alert alert-danger" role="alert">{courses.error}</div>
          <button className="btn btn-ghost" type="button" onClick={courses.reload}>{t('common.retry')}</button>
        </div>
      )}

      {courses.data && courses.data.length === 0 && (
        <EmptyState
          icon="book" title={t('teacher.empty.title')} text={t('teacher.empty.text')}
          action={<Link className="btn btn-primary" to="/academy"><Icon name="plus" size={18} /> {t('teacher.add')}</Link>}
        />
      )}

      {courses.data && courses.data.length > 0 && (
        <>
          <div className="section-row"><h2>{t('teacher.courses')}</h2></div>
          <div className="course-grid">
            {courses.data.map((c) => (
              <Link className="card course-card" key={c.id} to={`/teaching/courses/${c.id}`}>
                <div className="course-tags">
                  <span className="chip">{c.subject_name}</span>
                  <span className="badge badge-muted">{c.grade_name}</span>
                  <span className="badge badge-muted">{c.term_name}</span>
                </div>
                <h3>{c.name}</h3>
                <div className="progress-meta">
                  <span>{t('teacher.course.students', { n: c.student_count })}</span>
                  <span>{t('teacher.course.lessons', { n: c.total_lessons })}</span>
                </div>
                <div className="progress-meta">
                  <span>{t('teacher.course.assessments', { n: c.assessments_count })}</span>
                  <span>{c.average_percentage !== null ? t('teacher.course.average', { n: c.average_percentage }) : t('teacher.course.noResults')}</span>
                </div>
                <strong className="course-cta">{t('teacher.course.open')}</strong>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-row"><h2>{t('teacher.submissions.title')}</h2></div>
      <div className="dash-columns">
        <section className="card list-card">
          {loadingStats ? (
            <div className="card-pad"><Skeleton h={90} /></div>
          ) : !o || o.recent_submissions.length === 0 ? (
            <div className="empty-block"><p>{t('teacher.submissions.empty')}</p></div>
          ) : (
            o.recent_submissions.map((s) => (
              <Link className="list-row" key={s.attempt_id} to={`/teaching/assessments/${s.assessment_id}`}
                    state={{ title: s.assessment_title }}>
                <div>
                  <div className="list-title">{s.student_name}</div>
                  <div className="list-meta">{s.assessment_title} · {s.course_name} · {fmtDate(s.submitted_at, dateTime)}</div>
                </div>
                <span className={`score-pill ${s.is_passed ? 'ok' : 'bad'}`}>{s.percentage}%</span>
              </Link>
            ))
          )}
        </section>

        <section className="card list-card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <h3>{t('teacher.attention.title')}</h3>
            <p className="list-meta">{t('teacher.attention.hint', { n: o?.low_score_threshold ?? 60 })}</p>
          </div>
          {loadingStats ? (
            <div className="card-pad"><Skeleton h={90} /></div>
          ) : !o || o.attention.length === 0 ? (
            <div className="empty-block"><p>{t('teacher.attention.empty')}</p></div>
          ) : (
            o.attention.map((a) => (
              <div className="list-row" key={a.student_id}>
                <div>
                  <div className="list-title">{a.student_name}</div>
                  <div className="list-meta">{t('teacher.attention.attempts', { n: a.attempts_count })}</div>
                </div>
                <span className="score-pill bad">{a.average_percentage}%</span>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  )
}
