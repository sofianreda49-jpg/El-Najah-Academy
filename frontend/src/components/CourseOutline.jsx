import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/index.jsx'
import Icon from './Icon.jsx'
import ProgressBar from './ProgressBar.jsx'

/* شجرة الكورس الجانبية: الوحدات والدروس مع علامات الإكمال والدرس الحالي.
   على الموبايل بتتطوي وبتتفتح بزر. */
export default function CourseOutline({ course, currentLessonId }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const activeRef = useRef(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentLessonId, open])

  return (
    <aside className="card learn-side" aria-label={t('learn.courseContent')}>
      <button className="outline-toggle" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{t('learn.courseContent')}</span>
        <span className="muted">{course.completed_lessons}/{course.total_lessons}</span>
        <Icon name="chevronDown" size={18} />
      </button>

      <div className={`outline-body${open ? ' open' : ''}`}>
        <Link className="outline-course" to={`/learn/courses/${course.id}`}>{course.name}</Link>
        <ProgressBar done={course.completed_lessons} total={course.total_lessons} />
        <div className="progress-meta">
          <span>{t('learn.courseProgress', { done: course.completed_lessons, total: course.total_lessons })}</span>
        </div>

        {course.units.map((u) => (
          <div key={u.id}>
            <div className="outline-unit-title">{u.name}</div>
            {u.lessons.map((l) => (
              <Link
                key={l.id}
                ref={l.id === currentLessonId ? activeRef : null}
                to={`/learn/lessons/${l.id}`}
                className={`outline-item${l.id === currentLessonId ? ' current' : ''}`}
                aria-current={l.id === currentLessonId ? 'page' : undefined}
              >
                <span className={`lesson-status${l.is_completed ? ' done' : ''}`}>
                  {l.is_completed && <Icon name="check" size={14} />}
                </span>
                <span>{l.title}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
