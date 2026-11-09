import Icon from './Icon.jsx'
import { getLang, tr } from '../i18n/index.jsx'

export default function Pagination({ page, limit, total, onChange }) {
  if (!total) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const lastPage = Math.max(1, Math.ceil(total / limit))
  const rtl = getLang() === 'ar'

  return (
    <div className="pagination">
      <span className="muted">{tr("عرض")}{' '}{from}–{to}{' '}{tr("من")}{' '}{total}</span>
      <div className="pagination-buttons">
        <button className="btn btn-ghost btn-sm" type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name={rtl ? 'chevronRight' : 'chevronLeft'} size={16} />{' '}{tr("السابق")}</button>
        <span className="muted">{page} / {lastPage}</span>
        <button className="btn btn-ghost btn-sm" type="button" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>{tr("التالي")}{' '}<Icon name={rtl ? 'chevronLeft' : 'chevronRight'} size={16} />
        </button>
      </div>
    </div>
  )
}
