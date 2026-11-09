import { getLang, tr } from '../i18n/index.jsx'
// نقطة الاتصال الوحيدة بالباك إند. كل الشاشات بتستخدم api() من هنا.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api'
const TOKEN_KEY = 'najah_token'

// التوكن في sessionStorage: بيتمسح لما التاب يتقفل (أأمن من localStorage)
export const tokenStore = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function messageFrom(data) {
  const detail = data && data.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return tr("تحقق من البيانات المدخلة.")
  return tr("حدث خطأ غير متوقع.")
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Accept-Language': getLang() } // الباك إند بيرد بنفس اللغة
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, tr("تعذر الاتصال بالخادم. تأكد من تشغيل الباك إند."))
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // جلسة منتهية: نخرّج المستخدم (ماعدا شاشة الدخول نفسها)
    if (response.status === 401 && auth && token && onUnauthorized) onUnauthorized()
    throw new ApiError(response.status, messageFrom(data))
  }
  return data
}
