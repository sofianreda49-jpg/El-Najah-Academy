import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { tr } from '../i18n/index.jsx'

export default function ComingSoon({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card empty-state">
        <div className="empty-icon"><Icon name="sparkle" size={28} /></div>
        <h2>{tr("قريباً")}</h2>
        <p className="muted">{tr("هذه الشاشة هي الخطوة القادمة في بناء المنصة.")}</p>
      </div>
    </>
  )
}
