import { Link } from 'react-router-dom'

import { api } from '../../api/client.js'
import Icon from '../../components/Icon.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'

export default function CourseAssessments({ courseId }) {
  const { t } = useI18n()
  const { data } = useApi(() => api(`/student/courses/${courseId}/assessments`), [courseId])
  if (!data || data.length === 0) return null

  return (
    <section className="card assessments-card">
      <div className="section-head"><h3>{t('course.assessments')}</h3></div>
      <div className="lessons">
        {data.map((a) => (
          <Link className="lesson-link" key={a.id} to={`/learn/assessments/${a.id}`}>
            <span className="lesson-status exam"><Icon name="audit" size={14} /></span>
            <span className="lesson-link-title">{a.title}</span>
            <span className="chip">{t('course.assess.questions', { n: a.question_count })}</span>
            {a.time_limit_minutes && <span className="chip">{t('course.assess.minutes', { n: a.time_limit_minutes })}</span>}
            {a.best_percentage !== null ? (
              <span className={`badge ${a.passed ? 'badge-ok' : 'badge-bad'}`}>{t('course.assess.best', { n: a.best_percentage })}</span>
            ) : a.open_attempt_id ? (
              <span className="badge badge-gold">{t('course.assess.open')}</span>
            ) : (
              <span className="badge badge-muted">{t('course.assess.notStarted')}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
