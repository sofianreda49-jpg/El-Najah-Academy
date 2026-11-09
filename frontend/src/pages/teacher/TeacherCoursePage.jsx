import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import { useApi } from '../../hooks/useApi.js'
import { tr } from '../../i18n/index.jsx'

export default function TeacherCoursePage() {
  const { courseId } = useParams()
  const { data, loading, error, reload } = useApi(() => api(`/teacher/courses/${courseId}`), [courseId])

  return (
    <>
      <Link className="link-back" to="/"><Icon name="arrowRight" size={16} />{' '}{tr("الرجوع للرئيسية")}</Link>

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <PageHeader
              title={data.name}
              subtitle={`${data.subject_name} · ${data.grade_name} · ${data.term_name}`}
              actions={
                <Link className="btn btn-primary" to={`/academy/courses/${data.id}`}>
                  <Icon name="edit" size={16} />{' '}{tr("إدارة المحتوى والاختبارات")}</Link>
              }
            />

            <div className="stats stats-4">
              <div className="card stat-card"><div><div className="stat-value">{data.students.length}</div><div className="muted">{tr("طالب")}</div></div></div>
              <div className="card stat-card"><div><div className="stat-value">{data.total_lessons}</div><div className="muted">{tr("درس منشور")}</div></div></div>
              <div className="card stat-card"><div><div className="stat-value">{data.assessments.length}</div><div className="muted">{tr("اختبار")}</div></div></div>
            </div>

            <h2 className="section-title">{tr("الاختبارات")}</h2>
            <div className="card">
              {data.assessments.length === 0 ? (
                <div className="empty-state"><p className="muted">{tr("لا توجد اختبارات لهذا الكورس.")}</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>{tr("الاختبار")}</th><th>{tr("الحالة")}</th><th>{tr("الأسئلة")}</th><th>{tr("المحاولات")}</th><th>{tr("المتوسط")}</th><th>{tr("نسبة النجاح")}</th><th /></tr></thead>
                    <tbody>
                      {data.assessments.map((a) => (
                        <tr key={a.id}>
                          <td><strong>{a.title}</strong></td>
                          <td><span className={`badge ${a.is_published ? 'badge-ok' : 'badge-muted'}`}>{a.is_published ? tr("منشور") : tr("مسودة")}</span></td>
                          <td>{a.question_count}</td>
                          <td>{a.attempts_count}</td>
                          <td>{a.average_percentage !== null ? `${a.average_percentage}%` : '—'}</td>
                          <td>{a.pass_rate !== null ? `${a.pass_rate}%` : '—'}</td>
                          <td>
                            <Link className="btn btn-secondary btn-sm" to={`/teaching/assessments/${a.id}`} state={{ title: a.title }}>{tr("النتائج")}</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <h2 className="section-title">{tr("الطلاب")}</h2>
            <div className="card">
              {data.students.length === 0 ? (
                <div className="empty-state"><p className="muted">{tr("لا يوجد طلاب في هذا الصف بعد.")}</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>{tr("الطالب")}</th><th>{tr("التقدم في الدروس")}</th><th>{tr("محاولات الاختبار")}</th><th>{tr("المتوسط")}</th></tr></thead>
                    <tbody>
                      {data.students.map((s) => (
                        <tr key={s.id}>
                          <td><strong>{s.full_name}</strong></td>
                          <td className="progress-cell">
                            <ProgressBar done={s.completed_lessons} total={s.total_lessons} />
                            <small className="muted">{s.completed_lessons} / {s.total_lessons}</small>
                          </td>
                          <td>{s.attempts_count}</td>
                          <td>{s.average_percentage !== null ? `${s.average_percentage}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </AsyncBlock>
    </>
  )
}
