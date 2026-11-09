import { useEffect, useState } from 'react'

import { api } from '../api/client.js'
import AsyncBlock from '../components/AsyncBlock.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Pagination from '../components/Pagination.jsx'
import { ACTION_LABELS, ENTITY_LABELS } from '../constants.js'
import { useApi } from '../hooks/useApi.js'
import { formatDateTime } from '../utils/format.js'
import { tr } from '../i18n/index.jsx'

const LIMIT = 50

export default function Audit() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [action])

  const { data, loading, error, reload } = useApi(() => {
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (action) params.set('action', action)
    return api(`/audit-logs?${params}`)
  }, [page, action])

  return (
    <>
      <PageHeader title={tr("سجل العمليات")} subtitle={tr("كل عملية مهمة على المنصة: من نفّذها ومتى.")} />

      <div className="toolbar">
        <select className="input toolbar-select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{tr("كل العمليات")}</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <div className="card">
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
          {data && data.items.length === 0 ? (
            <div className="empty-state"><h2>{tr("لا توجد عمليات")}</h2></div>
          ) : (
            data && (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>{tr("الوقت")}</th><th>{tr("المنفّذ")}</th><th>{tr("العملية")}</th><th>{tr("الهدف")}</th><th>{tr("تفاصيل")}</th><th>IP</th></tr>
                    </thead>
                    <tbody>
                      {data.items.map((l) => (
                        <tr key={l.id}>
                          <td className="muted">{formatDateTime(l.created_at)}</td>
                          <td>{l.actor_name || '—'}</td>
                          <td><span className="badge badge-muted">{ACTION_LABELS[l.action] || l.action}</span></td>
                          <td>
                            {l.target_type
                              ? `${ENTITY_LABELS[l.target_type] || l.target_type}${l.target_id ? ` #${l.target_id}` : ''}`
                              : '—'}
                          </td>
                          <td>{l.detail || '—'}</td>
                          <td className="ltr-cell muted">{l.ip_address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} limit={LIMIT} total={data.total} onChange={setPage} />
              </>
            )
          )}
        </AsyncBlock>
      </div>
    </>
  )
}
