import Icon from './Icon.jsx'
import Skeleton from './Skeleton.jsx'

/* بطاقة رقم موحّدة. tone: navy | gold | green | blue. hint: سطر صغير تحت العنوان (اختياري) */
export default function StatCard({ icon, tone = 'navy', label, value, hint, loading = false }) {
  return (
    <div className="card stat-tile">
      <div className={`tile-icon ${tone}`}><Icon name={icon} /></div>
      <div>
        <div className="tile-value">{loading ? <Skeleton w={52} h={26} /> : value}</div>
        <div className="tile-label">{label}</div>
        {hint && !loading && <div className="tile-hint">{hint}</div>}
      </div>
    </div>
  )
}
