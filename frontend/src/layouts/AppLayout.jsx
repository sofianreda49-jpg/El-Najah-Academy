import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import UserMenu from '../components/UserMenu.jsx'
import { NAV } from '../constants.js'
import { useI18n } from '../i18n/index.jsx'
import iconLight from '../assets/logo-icon-light.png'

// مفاتيح الترجمة لعناصر القايمة (حسب المسار)
const NAV_KEYS = {
  '/': 'nav.home',
  '/users': 'nav.users',
  '/requests': 'nav.requests',
  '/academy': 'nav.academy',
  '/audit': 'nav.audit',
  '/results': 'nav.results',
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const isStaff = user.role === 'super_admin' || user.role === 'admin'

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // عداد الطلبات الجديدة (للمالك والمدير)
  useEffect(() => {
    if (!isStaff) return undefined
    let cancelled = false
    api('/registrations?status=pending&limit=1')
      .then((d) => { if (!cancelled) setPending(d.total) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isStaff, location.pathname])

  const items = NAV[user.role] || NAV.student
  const labelOf = (item) => (NAV_KEYS[item.to] ? t(NAV_KEYS[item.to]) : item.label)

  // عنوان القسم الحالي في الشريط العلوي
  const current = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)))
  const sectionTitle = current ? labelOf(current) : t('app.name')

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">{t('nav.skip')}</a>

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src={iconLight} alt="El Najah Academy" />
          <div>
            <strong>{t('app.name')}</strong>
            <span>El Najah Academy</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('nav.main')}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
                     className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name={item.icon} />
              <span>{labelOf(item)}</span>
              {item.badge && pending > 0 && <span className="nav-badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-link" type="button" onClick={logout}>
            <Icon name="logout" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" onClick={() => setOpen(true)} aria-label={t('nav.open')}>
            <Icon name="menu" />
          </button>
          <div className="topbar-title">{sectionTitle}</div>
          <div className="topbar-actions">
            <UserMenu />
          </div>
        </header>

        <main className="content" id="main" tabIndex={-1}>
          <Suspense fallback={<div className="state-box"><div className="spinner" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
