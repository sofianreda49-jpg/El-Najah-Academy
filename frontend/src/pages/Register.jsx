import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import LanguageSwitch from '../components/LanguageSwitch.jsx'
import Logo from '../components/Logo.jsx'
import { useApi } from '../hooks/useApi.js'
import { useI18n } from '../i18n/index.jsx'

const ROLES = [
  { key: 'student', icon: 'book' },
  { key: 'parent', icon: 'users' },
  { key: 'teacher', icon: 'academy' },
]

export default function Register() {
  const { state } = useLocation()
  const { acceptSession } = useAuth()
  const { t } = useI18n()
  const config = useApi(() => api('/auth/public-config', { auth: false }), [])

  const [role, setRole] = useState('student')
  const [fullName, setFullName] = useState(state?.name || '')
  const [gradeId, setGradeId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  if (!state?.registration_token) return <Navigate to="/login" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (fullName.trim().length < 2) return setError(t('reg.err.name'))
    if (role === 'student' && !gradeId) return setError(t('reg.err.grade'))
    setBusy(true)
    try {
      const res = await api('/auth/google/register', {
        method: 'POST',
        auth: false,
        body: {
          registration_token: state.registration_token,
          role,
          full_name: fullName.trim(),
          grade_id: role === 'student' ? Number(gradeId) : null,
          note: note.trim() || null,
        },
      })
      if (res.status === 'ok') {
        acceptSession(res) // اتفعّل فوراً: ندخله على لوحته مباشرة
        return
      }
      setDone(res.message)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="auth-single">
        <div className="auth-card register-card success-card">
          <div className="empty-icon"><Icon name="check" size={28} /></div>
          <h2>{t('reg.sent')}</h2>
          <p className="muted">{done}</p>
          <Link className="btn btn-primary btn-block" to="/login">{t('reg.backToLogin')}</Link>
        </div>
      </div>
    )
  }

  const grades = config.data?.grades || []
  const noteLabel = role === 'parent' ? t('reg.note.parent') : role === 'teacher' ? t('reg.note.teacher') : null

  return (
    <div className="auth-single">
      <form className="auth-card register-card" onSubmit={submit} noValidate>
        <div className="auth-lang"><LanguageSwitch /></div>
        <div className="auth-card-logo"><Logo variant="icon" /></div>
        <h2>{t('reg.title')}</h2>
        <p className="muted">{t('reg.google')} <span className="ltr-inline">{state.email}</span></p>

        <div className="role-grid" role="radiogroup" aria-label={t('reg.accountType')}>
          {ROLES.map((r) => (
            <label key={r.key} className={`role-card${role === r.key ? ' on' : ''}`}>
              <input type="radio" name="role" className="sr-only" checked={role === r.key}
                     onChange={() => setRole(r.key)} />
              <Icon name={r.icon} size={26} />
              <strong>{t(`reg.${r.key}`)}</strong>
              <small>{t(`reg.${r.key}.desc`)}</small>
            </label>
          ))}
        </div>

        <div className="field">
          <label htmlFor="full_name">{t('reg.fullName')}</label>
          <input id="full_name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        {role === 'student' && (
          <div className="field">
            <label htmlFor="grade">{t('reg.grade')}</label>
            <select id="grade" className="input" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">{t('reg.gradePlaceholder')}</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {noteLabel && (
          <div className="field">
            <label htmlFor="note">{noteLabel}</label>
            <textarea id="note" className="input" rows={2} maxLength={500} value={note}
                      onChange={(e) => setNote(e.target.value)} />
          </div>
        )}

        <div className="alert alert-warn">
          {role === 'teacher' ? t('reg.notice.teacher') : t('reg.notice.pending')}
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? t('reg.submitting') : t('reg.submit')}
        </button>
        <Link className="btn btn-ghost btn-block" to="/login">{t('reg.cancel')}</Link>
      </form>
    </div>
  )
}
