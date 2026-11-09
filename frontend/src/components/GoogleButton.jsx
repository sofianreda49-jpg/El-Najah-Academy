import { useEffect, useRef } from 'react'
import { getLang, tr } from '../i18n/index.jsx'

// تحميل سكريبت جوجل مرة واحدة بس
let scriptPromise = null
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.onload = resolve
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('load failed'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

export default function GoogleButton({ clientId, onCredential, onError }) {
  const holder = useRef(null)
  const handler = useRef(onCredential)
  handler.current = onCredential

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handler.current(response.credential),
          ux_mode: 'popup',
          auto_select: false,
        })
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', locale: getLang(), width: 320,
        })
      })
      .catch(() => onError?.(tr("تعذر تحميل تسجيل الدخول بجوجل. تأكد من الاتصال بالإنترنت.")))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  return <div ref={holder} className="google-btn" />
}
