import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext.jsx'
import LanguageSwitch from '../components/LanguageSwitch.jsx'
import Logo from '../components/Logo.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError(t('cp.err.short'))
    if (next !== confirm) return setError(t('cp.err.mismatch'))
    setBusy(true)
    try {
      await changePassword(current, next)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-single">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <div className="auth-lang"><LanguageSwitch /></div>
        <div className="auth-card-logo"><Logo variant="icon" /></div>
        <h2>{t('cp.title')}</h2>
        <p className="muted">{user?.must_change_password ? t('cp.temp') : t('cp.hint')}</p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="current">{t('cp.current')}</label>
          <input id="current" className="input ltr" type="password" autoComplete="current-password"
                 value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="next">{t('cp.new')}</label>
          <input id="next" className="input ltr" type="password" autoComplete="new-password"
                 value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="confirm">{t('cp.confirm')}</label>
          <input id="confirm" className="input ltr" type="password" autoComplete="new-password"
                 value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? t('common.saving') : t('cp.submit')}
        </button>
        <button className="btn btn-ghost btn-block" type="button" onClick={logout}>{t('common.logout')}</button>
      </form>
    </div>
  )
}
