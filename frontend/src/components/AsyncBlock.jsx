import { tr } from '../i18n/index.jsx'
// بيعرض تحميل / خطأ مع زر إعادة محاولة، أو المحتوى لو البيانات جاهزة
export default function AsyncBlock({ data, loading, error, onRetry, children }) {
  if (loading && !data) {
    return <div className="state-box"><div className="spinner" /></div>
  }
  if (error) {
    return (
      <div className="state-box">
        <div className="alert alert-danger" role="alert">{error}</div>
        {onRetry && <button className="btn btn-ghost" type="button" onClick={onRetry}>{tr("إعادة المحاولة")}</button>}
      </div>
    )
  }
  return children
}
