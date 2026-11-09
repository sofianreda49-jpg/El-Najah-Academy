import { useState } from 'react'

import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import { useDebounce } from '../hooks/useDebounce.js'
import AsyncBlock from './AsyncBlock.jsx'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import { useToast } from './Toast.jsx'
import { tr } from '../i18n/index.jsx'

/* نافذة ربط ولي الأمر بأبنائه: عرض المربوطين، فك الربط، وبحث عن طالب لربطه */
export default function ChildrenModal({ parent, onClose }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [busyId, setBusyId] = useState(null)

  const linked = useApi(() => api(`/parents/${parent.id}/children`), [parent.id])

  const searchTerm = debouncedQ.trim()
  const search = useApi(
    () => (searchTerm.length >= 2
      ? api(`/users?role=student&is_active=true&limit=8&q=${encodeURIComponent(searchTerm)}`)
      : Promise.resolve(null)),
    [searchTerm],
  )

  const linkedIds = new Set((linked.data || []).map((c) => c.id))

  async function act(studentId, method, message) {
    setBusyId(studentId)
    try {
      await api(`/parents/${parent.id}/children/${studentId}`, { method })
      toast.success(message)
      linked.reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal wide title={tr("أبناء: {full_name}", { full_name: parent.full_name })} onClose={onClose}
           footer={<button className="btn btn-primary" type="button" onClick={onClose}>{tr("تم")}</button>}>
      <h3 className="card-title">{tr("الأبناء المربوطون")}</h3>
      <AsyncBlock data={linked.data} loading={linked.loading} error={linked.error} onRetry={linked.reload}>
        {linked.data && linked.data.length === 0 && <p className="muted">{tr("لا يوجد أبناء مربوطون بهذا الحساب بعد.")}</p>}
        {linked.data && linked.data.length > 0 && (
          <div className="lessons">
            {linked.data.map((c) => (
              <div className="tree-row" key={c.id}>
                <span><strong>{c.full_name}</strong> <span className="muted ltr">{c.email}</span></span>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === c.id}
                        onClick={() => act(c.id, 'DELETE', tr("تم فك الربط"))}>{tr("فك الربط")}</button>
              </div>
            ))}
          </div>
        )}
      </AsyncBlock>

      <h3 className="card-title link-title">{tr("ربط طالب")}</h3>
      <div className="search">
        <Icon name="search" size={18} />
        <input className="input" type="search" placeholder={tr("ابحث عن الطالب بالاسم أو البريد...")} value={q}
               onChange={(e) => setQ(e.target.value)} />
      </div>

      {searchTerm.length >= 2 && (
        <AsyncBlock data={search.data} loading={search.loading} error={search.error} onRetry={search.reload}>
          {search.data && search.data.items.length === 0 && <p className="muted">{tr("لا توجد نتائج.")}</p>}
          {search.data && search.data.items.length > 0 && (
            <div className="lessons link-results">
              {search.data.items.map((s) => (
                <div className="tree-row" key={s.id}>
                  <span><strong>{s.full_name}</strong> <span className="muted ltr">{s.email}</span></span>
                  {linkedIds.has(s.id) ? (
                    <span className="badge badge-ok">{tr("مربوط")}</span>
                  ) : (
                    <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === s.id}
                            onClick={() => act(s.id, 'POST', tr("تم ربط الطالب"))}>
                      <Icon name="plus" size={14} />{' '}{tr("ربط")}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </AsyncBlock>
      )}
    </Modal>
  )
}
