import fullDark from '../assets/logo-full.png'
import fullLight from '../assets/logo-full-light.png'
import iconDark from '../assets/logo-icon.png'
import iconLight from '../assets/logo-icon-light.png'

// بيعرض النسخة الغامقة في الوضع الفاتح، والفاتحة في الوضع الليلي (بالـ CSS)
export default function Logo({ variant = 'icon', className = '' }) {
  const [onLight, onDark] = variant === 'full' ? [fullDark, fullLight] : [iconDark, iconLight]
  return (
    <>
      <img src={onLight} alt="El Najah Academy" className={`logo-on-light ${className}`} />
      <img src={onDark} alt="" aria-hidden="true" className={`logo-on-dark ${className}`} />
    </>
  )
}
