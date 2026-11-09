import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { api } from '../../api/client.js'
import AsyncBlock from '../../components/AsyncBlock.jsx'
import Icon from '../../components/Icon.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useApi } from '../../hooks/useApi.js'
import { formatDateTime } from '../../utils/format.js'
import { tr } from '../../i18n/index.jsx'

export default function TeacherResults() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const limit = 30

  const { data, loading, error, reload } = useApi(
    () => api(`/teacher/assessments/${assessmentId}/results?page=${page}&limit=${limit}`),
    [assessmentId, page],
  )

  return (
    <>
      <button className="link-back" type="button" onClick={() => navigate(-1)}>
        <Icon name="arrowRight" size={16} />{' '}{tr("رجوع")}</button>
      <PageHeader title={tr("نتائج الاختبار")} subtitle={location.state?.title || ''} />

      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="stats stats-4">
              <div className="card stat-card"><div><div className="stat-value">{data.summary.attempts}</div><div className="muted">{tr("محاولة")}</div></div></div>
              <div className="card stat-card"><div><div className="stat-value">{data.summary.students}</div><div className="muted">{tr("طالب")}</div></div></div>
              <div className="card stat-card"><div><div className="stat-value">{data.summary.average_percentage}%</div><div className="muted">{tr("متوسط الدرجات")}</div></div></div>
              <div className="card stat-card"><div><div className="stat-value">{data.summary.pass_rate}%</div><div className="muted">{tr("نسبة النجاح")}</div></div></div>
            </div>

            <div className="card">
              {data.items.length === 0 ? (
                <div className="empty-state"><h2>{tr("لا توجد نتائج بعد")}</h2></div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>{tr("الطالب")}</th><th>{tr("المحاولة")}</th><th>{tr("الدرجة")}</th><th>{tr("النسبة")}</th><th>{tr("النتيجة")}</th><th>{tr("الوقت")}</th></tr></thead>
                      <tbody>
                        {data.items.map((r) => (
                          <tr key={r.id}>
                            <td><strong>{r.student_name}</strong></td>
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
                  <Pagination page={page} limit={limit} total={data.total} onChange={setPage} />
                </>
              )}
            </div>
          </>
        )}
      </AsyncBlock>
    </>
  )
}
