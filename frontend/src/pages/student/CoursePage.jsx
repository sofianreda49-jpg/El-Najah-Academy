import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Icon from '../../components/Icon.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import StatCard from '../../components/StatCard.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'
import CourseAssessments from './CourseAssessments.jsx'

function UnitSection({ unit, t }) {
  const [open, setOpen] = useState(true)
  const done = unit.lessons.filter((l) => l.is_completed).length

  return (
    <section className="card unit-block">
      <button className="unit-head" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <div>
          <h3>{unit.name}</h3>
          {unit.description && <p className="muted">{unit.description}</p>}
        </div>
        <span className="unit-count">{done}/{unit.lessons.length}</span>
        <Icon name="chevronDown" size={18} />
      </button>
      {open && (
        <div className="lessons">
          {unit.lessons.map((l) => (
            <Link className="lesson-link" key={l.id} to={`/learn/lessons/${l.id}`}>
              <span className={`lesson-status${l.is_completed ? ' done' : ''}`}>
                {l.is_completed && <Icon name="check" size={14} />}
              </span>
              <span className="lesson-link-title">{l.title}</span>
              {l.has_video && <span className="chip"><Icon name="play" size={14} /> {t('learn.video')}</span>}
              {l.has_file && <span className="chip"><Icon name="file" size={14} /> {t('learn.file')}</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CoursePage() {
  const { courseId } = useParams()
  const { t, dir } = useI18n()
  const { data, loading, error, reload } = useApi(() => api(`/student/courses/${courseId}`), [courseId])
  const backIcon = dir === 'rtl' ? 'arrowRight' : 'chevronLeft'

  return (
    <>
      <Link className="link-back" to="/"><Icon name={backIcon} size={16} /> {t('learn.home')}</Link>

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (() => {
          const percent = data.total_lessons ? Math.round((data.completed_lessons * 100) / data.total_lessons) : 0
          const finished = data.total_lessons > 0 && data.completed_lessons >= data.total_lessons
          return (
            <>
              <section className="dash-hero">
                <div className="hero-pills">
                  <span className="hero-pill">{data.subject_name}</span>
                  <span className="hero-pill">{data.term_name}</span>
                </div>
                <h1 style={{ marginTop: 12 }}>{data.name}</h1>
                {data.description && <p>{data.description}</p>}
                <div className="hero-progress">
                  <ProgressBar done={data.completed_lessons} total={data.total_lessons} />
                  <small>{finished ? t('learn.finishedCourse') : t('learn.courseProgress', { done: data.completed_lessons, total: data.total_lessons })}</small>
                </div>
                {data.next_lesson_id && (
                  <Link className="hero-cta" to={`/learn/lessons/${data.next_lesson_id}`}>
                    <Icon name="play" size={18} />
                    {data.completed_lessons === 0 ? t('course.start') : t('course.resume')}
                  </Link>
                )}
              </section>

              <div className="stat-tiles">
                <StatCard icon="book" tone="navy" label={t('course.stat.lessons')} value={data.total_lessons} />
                <StatCard icon="check" tone="green" label={t('course.stat.completed')} value={data.completed_lessons} />
                <StatCard icon="layers" tone="gold" label={t('course.stat.units')} value={data.units.length} />
                <StatCard icon="chart" tone="blue" label={t('course.stat.progress')} value={`${percent}%`} />
              </div>

              <CourseAssessments courseId={courseId} />

              {data.units.length === 0 ? (
                <EmptyState icon="book" title={t('course.noLessons.title')} text={t('course.noLessons.text')} />
              ) : (
                <div className="units">
                  {data.units.map((u) => <UnitSection key={u.id} unit={u} t={t} />)}
                </div>
              )}
            </>
          )
        })()}
      </AsyncBlock>
    </>
  )
}
