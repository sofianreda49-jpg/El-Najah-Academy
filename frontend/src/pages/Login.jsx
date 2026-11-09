import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import GoogleButton from '../components/GoogleButton.jsx'
import Icon from '../components/Icon.jsx'
import LanguageSwitch from '../components/LanguageSwitch.jsx'
import { useApi } from '../hooks/useApi.js'
import { useI18n } from '../i18n/index.jsx'
import fullDark from '../assets/logo-full.png'
import { tr } from '../i18n/index.jsx'

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const config = useApi(() => api('/auth/public-config', { auth: false }), [])
  const googleClientId = config.data?.google_client_id

  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null) // { type: 'pending' | 'rejected', message }
  const [busy, setBusy] = useState(false)

  const goHome = () => navigate(location.state?.from?.pathname || '/', { replace: true })

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice(null)
    setBusy(true)
    try {
      await login(email, password)
      goHome()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // نفس الزر للدخول والتسجيل: لو الحساب موجود بيدخل، ولو جديد بيروح لاختيار نوع الحساب
  async function onGoogle(credential) {
    setError('')
    setNotice(null)
    setBusy(true)
    try {
      const res = await loginWithGoogle(credential)
      if (res.status === 'ok') goHome()
      else if (res.status === 'needs_registration') navigate('/register', { state: res })
      else setNotice({ type: res.status, message: res.message })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const googleReady = Boolean(googleClientId)

  return (
    <div className="auth-page">
      <section className="auth-brand">
        <img src={fullDark} alt="El Najah Academy" />
        <div className="gold-divider" />
        <p>{t('auth.brand.desc')}</p>
        <ul className="brand-points">
          <li><Icon name="check" size={16} /> {t('auth.brand.p1')}</li>
          <li><Icon name="check" size={16} /> {t('auth.brand.p2')}</li>
          <li><Icon name="check" size={16} /> {t('auth.brand.p3')}</li>
        </ul>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-lang"><LanguageSwitch /></div>

          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'}
                    className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => switchMode('login')}>
              {t('auth.tab.login')}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'}
                    className={`auth-tab${mode === 'register' ? ' active' : ''}`} onClick={() => switchMode('register')}>
              {t('auth.tab.register')}
            </button>
          </div>

          {notice && (
            <div className={`alert ${notice.type === 'pending' ? 'alert-warn' : 'alert-danger'}`} role="status">
              {notice.message}
            </div>
          )}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          {!googleReady && config.data && import.meta.env.DEV && (
            <div className="alert alert-warn">{tr("زر جوجل مخفي لأن")}{' '}<code>GOOGLE_CLIENT_ID</code>{' '}{tr("مش مضبوط في")}{' '}<code>backend\.env</code>{' '}{tr("(الرسالة دي بتظهر لك وقت التطوير بس).")}</div>
          )}

          {mode === 'register' ? (
            <>
              <h2>{t('auth.register.title')}</h2>
              <p className="muted">{t('auth.register.subtitle')}</p>
              <div className="role-hints">
                <span><Icon name="book" size={16} /> {t('role.student')}</span>
                <span><Icon name="users" size={16} /> {t('role.parent')}</span>
                <span><Icon name="academy" size={16} /> {t('role.teacher')}</span>
              </div>
              {googleReady ? (
                <>
                  <GoogleButton clientId={googleClientId} onCredential={onGoogle} onError={setError} />
                  <p className="auth-hint">{t('auth.hint.register')}</p>
                </>
              ) : (
                <div className="alert alert-warn">{t('auth.google.unavailable')}</div>
              )}
            </>
          ) : (
            <>
              <h2>{t('auth.login.title')}</h2>
              <p className="muted">{t('auth.login.subtitle')}</p>

              {googleReady && (
                <>
                  <GoogleButton clientId={googleClientId} onCredential={onGoogle} onError={setError} />
                  <p className="auth-hint">{t('auth.hint.login')}</p>
                  <div className="or-divider"><span>{t('auth.or')}</span></div>
                </>
              )}

              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <label htmlFor="email">{t('auth.email')}</label>
                  <input id="email" className="input ltr" type="email" autoComplete="username"
                         value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="password">{t('auth.password')}</label>
                  <div className="input-wrap">
                    <input id="password" className="input ltr with-toggle" type={show ? 'text' : 'password'}
                           autoComplete="current-password" value={password}
                           onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="toggle-visibility" onClick={() => setShow((v) => !v)}
                            aria-label={show ? t('auth.password.hide') : t('auth.password.show')}>
                      <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>
                </div>

                <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email || !password}>
                  {busy ? t('auth.submitting') : t('auth.submit')}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
