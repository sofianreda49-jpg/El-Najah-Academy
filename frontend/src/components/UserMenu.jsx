import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext.jsx'
import { ENGLISH_ENABLED, useI18n } from '../i18n/index.jsx'
import { currentTheme, toggleTheme } from '../theme.js'
import Icon from './Icon.jsx'
import LanguageSwitch from './LanguageSwitch.jsx'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(currentTheme())
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-trigger" type="button" aria-haspopup="menu" aria-expanded={open}
              aria-label={t('common.menu')} onClick={() => setOpen((v) => !v)}>
        <span className="avatar sm">{user.full_name.charAt(0)}</span>
        <span className="user-trigger-name">{user.full_name}</span>
        <Icon name="chevronDown" size={16} />
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          <div className="menu-head">
            <strong>{user.full_name}</strong>
            <small>{user.email}</small>
            <span className="badge badge-gold">{t(`role.${user.role}`)}</span>
          </div>

          <Link className="menu-item" role="menuitem" to="/profile" onClick={() => setOpen(false)}>
            <Icon name="user" size={18} /> {t('nav.profile')}
          </Link>
          <button className="menu-item" role="menuitem" type="button" onClick={() => setTheme(toggleTheme())}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            {theme === 'dark' ? t('common.theme.light') : t('common.theme.dark')}
          </button>
          {ENGLISH_ENABLED && (
            <div className="menu-item" role="none">
              <Icon name="globe" size={18} /> <LanguageSwitch />
            </div>
          )}
          <div className="menu-sep" />
          <button className="menu-item danger" role="menuitem" type="button" onClick={logout}>
            <Icon name="logout" size={18} /> {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  )
}
