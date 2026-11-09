import { useState } from 'react'

import { useAuth } from '../auth/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useToast } from '../components/Toast.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth()
  const { t, fmtDate } = useI18n()
  const toast = useToast()

  const [name, setName] = useState(user.full_name)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState('')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')

  async function saveName(e) {
    e.preventDefault()
    setNameError('')
    if (name.trim().length < 2) return setNameError(t('reg.err.name'))
    setNameBusy(true)
    try {
      await updateProfile(name.trim())
      toast.success(t('profile.saved'))
    } catch (err) {
      setNameError(err.message)
    } finally {
      setNameBusy(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwError('')
    if (next.length < 8) return setPwError(t('cp.err.short'))
    if (next !== confirm) return setPwError(t('cp.err.mismatch'))
    setPwBusy(true)
    try {
      await changePassword(current, next)
      toast.success(t('cp.saved'))
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwBusy(false)
    }
  }

  const dateTime = { dateStyle: 'medium', timeStyle: 'short' }

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="profile-grid">
        <section className="card">
          <div className="profile-head">
            <div className="avatar lg">{user.full_name.charAt(0)}</div>
            <div>
              <h2>{user.full_name}</h2>
              <span className="badge badge-gold">{t(`role.${user.role}`)}</span>
            </div>
          </div>

          <form onSubmit={saveName} noValidate>
            <div className="field">
              <label htmlFor="pf-name">{t('profile.fullName')}</label>
              <input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
            </div>
            <div className="field">
              <label htmlFor="pf-email">{t('profile.email')}</label>
              <input id="pf-email" className="input ltr" value={user.email} readOnly />
              <small className="help">{t('profile.emailNote')}</small>
            </div>
            {nameError && <div className="alert alert-danger" role="alert">{nameError}</div>}
            <button className="btn btn-primary btn-block" type="submit"
                    disabled={nameBusy || name.trim() === user.full_name}>
              {nameBusy ? t('common.saving') : t('profile.save')}
            </button>
          </form>

          <div className="profile-meta">
            <div>{t('profile.lastLogin')}: <strong>{fmtDate(user.last_login_at, dateTime) === '—' ? t('profile.never') : fmtDate(user.last_login_at, dateTime)}</strong></div>
            <div>{t('profile.joined')}: <strong>{fmtDate(user.created_at)}</strong></div>
          </div>
        </section>

        <section className="card">
          <h2>{t('profile.security')}</h2>
          <p className="muted">{t('profile.passwordHint')}</p>
          <form onSubmit={savePassword} noValidate>
            <div className="field">
              <label htmlFor="pf-cur">{t('cp.current')}</label>
              <input id="pf-cur" className="input ltr" type="password" autoComplete="current-password"
                     value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pf-new">{t('cp.new')}</label>
              <input id="pf-new" className="input ltr" type="password" autoComplete="new-password"
                     value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pf-conf">{t('cp.confirm')}</label>
              <input id="pf-conf" className="input ltr" type="password" autoComplete="new-password"
                     value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {pwError && <div className="alert alert-danger" role="alert">{pwError}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={pwBusy || !current || !next || !confirm}>
              {pwBusy ? t('common.saving') : t('cp.submit')}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
