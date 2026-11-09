import { Link, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import { useApi } from '../../hooks/useApi.js'
import { formatDateTime } from '../../utils/format.js'
import { tr } from '../../i18n/index.jsx'

export default function ChildPage() {
  const { studentId } = useParams()
  const { data, loading, error, reload } = useApi(() => api(`/parent/children/${studentId}`), [studentId])

  return (
    <>
      <Link className="link-back" to="/"><Icon name="arrowRight" size={16} />{' '}{tr("الرجوع للرئيسية")}</Link>

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (() => {
          const o = data.overview
          const percent = o.total_lessons ? Math.round((o.completed_lessons * 100) / o.total_lessons) : 0
          const avg = data.results.length
            ? Math.round(data.results.reduce((sum, r) => sum + r.percentage, 0) / data.results.length)
            : null
          return (
            <>
              <PageHeader title={data.full_name}
                          subtitle={[o.grade?.name, o.year && tr("السنة الدراسية {year}", { year: o.year })].filter(Boolean).join(' · ')} />

              <div className="stats stats-4">
                <div className="card stat-card"><div><div className="stat-value">{percent}%</div><div className="muted">{tr("التقدم في الدروس")}</div></div></div>
                <div className="card stat-card"><div><div className="stat-value">{o.completed_lessons}/{o.total_lessons}</div><div className="muted">{tr("دروس مكتملة")}</div></div></div>
                <div className="card stat-card"><div><div className="stat-value">{data.results.length}</div><div className="muted">{tr("محاولات اختبار")}</div></div></div>
                <div className="card stat-card"><div><div className="stat-value">{avg !== null ? `${avg}%` : '—'}</div><div className="muted">{tr("متوسط الدرجات")}</div></div></div>
              </div>

              <h2 className="section-title">{tr("الكورسات")}</h2>
              {!o.grade ? (
                <div className="card empty-state"><p className="muted">{tr("لم يتم تحديد صف الطالب بعد.")}</p></div>
              ) : o.courses.length === 0 ? (
                <div className="card empty-state"><p className="muted">{tr("لا توجد كورسات منشورة لصفه حالياً.")}</p></div>
              ) : (
                <div className="course-grid">
                  {o.courses.map((c) => (
                    <div className="card course-card static" key={c.id}>
                      <div className="course-tags">
                        <span className="chip">{c.subject_name}</span>
                        <span className="badge badge-muted">{c.term_name}</span>
                      </div>
                      <h3>{c.name}</h3>
                      <div className="course-progress">
                        <ProgressBar done={c.completed_lessons} total={c.total_lessons} />
                        <div className="progress-meta"><span>{c.completed_lessons} / {c.total_lessons}{' '}{tr("درس")}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h2 className="section-title">{tr("نتائج الاختبارات")}</h2>
              <div className="card">
                {data.results.length === 0 ? (
                  <div className="empty-state"><p className="muted">{tr("لم يحل أي اختبار بعد.")}</p></div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>{tr("الاختبار")}</th><th>{tr("الكورس")}</th><th>{tr("المحاولة")}</th><th>{tr("الدرجة")}</th><th>{tr("النسبة")}</th><th>{tr("النتيجة")}</th><th>{tr("التاريخ")}</th></tr>
                      </thead>
                      <tbody>
                        {data.results.map((r) => (
                          <tr key={r.attempt_id}>
                            <td><strong>{r.assessment_title}</strong></td>
                            <td className="muted">{r.course_name}</td>
                            <td>{r.attempt_number}</td>
                            <td>{r.score} / {r.max_score}</td>
                            <td>{r.percentage}%</td>
                            <td>
                              <span className={`badge ${r.is_passed ? 'badge-ok' : 'badge-bad'}`}>{r.is_passed ? tr("ناجح") : tr("لم ينجح")}</span>
                              {r.status === 'expired' && <span className="badge badge-muted mr-6">{tr("انتهى الوقت")}</span>}
                            </td>
                            <td className="muted">{formatDateTime(r.submitted_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="muted view-only">{tr("وضع المشاهدة فقط: لا يمكن لولي الأمر تعديل أي بيانات.")}</p>
            </>
          )
        })()}
      </AsyncBlock>
    </>
  )
}
