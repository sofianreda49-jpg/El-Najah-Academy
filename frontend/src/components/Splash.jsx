import Logo from './Logo.jsx'
import { tr } from '../i18n/index.jsx'

export default function Splash() {
  return (
    <div className="splash" role="status" aria-label={tr("جاري التحميل")}>
      <Logo variant="icon" className="splash-logo" />
      <div className="spinner" />
    </div>
  )
}
