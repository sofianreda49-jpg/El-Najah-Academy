import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import CourseOutline from '../../components/CourseOutline.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/Toast.jsx'
import VideoPlayer from '../../components/VideoPlayer.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useI18n } from '../../i18n/index.jsx'

export default function LessonPage() {
  const { lessonId } = useParams()
  const toast = useToast()
  const { t, dir } = useI18n()
  const [busy, setBusy] = useState(false)

  // طلب واحد: الدرس + شجرة الكورس
  const { data, loading, error, reload } = useApi(() => api(`/student/lessons/${lessonId}/player`), [lessonId])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [lessonId])

  async function toggleComplete() {
    const lesson = data.lesson
    setBusy(true)
    try {
      await api(`/student/lessons/${lesson.id}/complete`, { method: lesson.is_completed ? 'DELETE' : 'POST' })
      toast.success(lesson.is_completed ? t('learn.toastUndone') : t('learn.toastDone'))
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const lesson = data?.lesson
  const course = data?.course
  const prevIcon = dir === 'rtl' ? 'chevronRight' : 'chevronLeft'
  const nextIcon = dir === 'rtl' ? 'chevronLeft' : 'chevronRight'

  return (
    <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
      {data && (
        <div className={`learn-layout${loading ? ' is-loading' : ''}`}>
          <div className="learn-main">
            <nav className="crumbs" aria-label="breadcrumb">
              <Link to="/">{t('learn.home')}</Link>
              <span aria-hidden="true">/</span>
              <Link to={`/learn/courses/${course.id}`}>{course.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{lesson.unit_name}</span>
            </nav>

            <header className="lesson-top">
              <h1 className="lesson-title">{lesson.title}</h1>
              <span className="muted">{t('learn.lessonOf', { n: lesson.position, total: lesson.total })}</span>
              <div className="lesson-progress-line" aria-hidden="true">
                <span style={{ width: `${(lesson.position / lesson.total) * 100}%` }} />
              </div>
            </header>

            {lesson.video_url && <VideoPlayer url={lesson.video_url} title={lesson.title} />}

            {lesson.content && <div className="card lesson-content">{lesson.content}</div>}

            {lesson.file_url && (
              <section className="card resource-card">
                <h3>{t('learn.resources')}</h3>
                <a className="btn btn-secondary" href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                  <Icon name="file" size={18} /> {t('learn.openFile')}
                </a>
              </section>
            )}

            {!lesson.content && !lesson.video_url && !lesson.file_url && (
              <div className="card empty-block"><p>{t('learn.noContent')}</p></div>
            )}

            <div className="lesson-bar">
              {lesson.prev_id ? (
                <Link className="btn btn-ghost" to={`/learn/lessons/${lesson.prev_id}`}>
                  <Icon name={prevIcon} size={16} /> {t('learn.prev')}
                </Link>
              ) : <span />}

              <button className={`btn ${lesson.is_completed ? 'btn-ghost' : 'btn-done'}`} type="button"
                      onClick={toggleComplete} disabled={busy}>
                <Icon name="check" size={18} />
                {lesson.is_completed ? `${t('learn.completed')} (${t('learn.undo')})` : t('learn.markComplete')}
              </button>

              {lesson.next_id ? (
                <Link className={`btn ${lesson.is_completed ? 'btn-primary' : 'btn-ghost'}`} to={`/learn/lessons/${lesson.next_id}`}>
                  {t('learn.next')} <Icon name={nextIcon} size={16} />
                </Link>
              ) : <span />}
            </div>
          </div>

          <CourseOutline course={course} currentLessonId={lesson.id} />
        </div>
      )}
    </AsyncBlock>
  )
}
