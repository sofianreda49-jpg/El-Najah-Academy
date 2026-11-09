import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // لو فيه توكن محفوظ: نتأكد منه ونجيب بيانات المستخدم
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!tokenStore.get()) {
        setLoading(false)
        return
      }
      try {
        const me = await api('/auth/me')
        if (!cancelled) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
      auth: false,
    })
    tokenStore.set(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const data = await api('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    })
    tokenStore.set(data.access_token)
    setUser(data.user)
  }, [])

  const updateProfile = useCallback(async (fullName) => {
    const me = await api('/auth/me', { method: 'PATCH', body: { full_name: fullName } })
    setUser(me)
    return me
  }, [])

  // لما التسجيل بجوجل يتفعّل فوراً ويرجّع توكن
  const acceptSession = useCallback((data) => {
    tokenStore.set(data.access_token)
    setUser(data.user)
  }, [])

  // بيرجّع status: ok | needs_registration | pending | rejected
  const loginWithGoogle = useCallback(async (credential) => {
    const data = await api('/auth/google', { method: 'POST', body: { credential }, auth: false })
    if (data.status === 'ok') {
      tokenStore.set(data.access_token)
      setUser(data.user)
    }
    return data
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, acceptSession, logout, changePassword, updateProfile }),
    [user, loading, login, loginWithGoogle, acceptSession, logout, changePassword, updateProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
