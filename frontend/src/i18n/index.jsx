import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import ar from './ar.js'
import en from './en.js'

const DICTS = { ar, en }
const STORAGE_KEY = 'najah_lang'

// الإنجليزي مفعّل. (لإخفائه مؤقتاً: VITE_DISABLE_ENGLISH=true في frontend/.env.local)
export const ENGLISH_ENABLED = import.meta.env.VITE_DISABLE_ENGLISH !== 'true'

function initialLang() {
  if (!ENGLISH_ENABLED) return 'ar'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ar' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return 'ar'
}

// اللغة الحالية خارج React (بتستخدمها tr() و getLocale() و api client)
let currentLang = initialLang()
export const getLang = () => currentLang
export const getLocale = () => (currentLang === 'ar' ? 'ar-EG' : 'en-GB')

function translate(lang, key, vars) {
  let text = DICTS[lang][key] ?? DICTS.ar[key] ?? key
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
  return text
}

/* ترجمة من أي مكان (حتى خارج المكونات). النص العربي نفسه هو المفتاح:
   tr('حفظ') بترجع 'Save' في الإنجليزي، ولو مفيش ترجمة بترجع النص كما هو. */
export function tr(key, vars) {
  return translate(currentLang, key, vars)
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(currentLang)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  currentLang = lang // متزامن مع الريندر علشان tr() تشوف اللغة الصح

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((next) => {
    if (!ENGLISH_ENABLED || (next !== 'ar' && next !== 'en')) return
    currentLang = next
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])

  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const fmtDate = useCallback(
    (value, options = { dateStyle: 'medium' }) => (value ? new Date(value).toLocaleString(locale, options) : '—'),
    [locale],
  )

  const value = useMemo(() => ({ lang, dir, setLang, t, fmtDate }), [lang, dir, setLang, t, fmtDate])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

/* بيعمل remount لكل الشاشات لما اللغة تتغير، علشان أي نص اتحسب بـ tr() يتحدّث */
export function LanguageKey({ children }) {
  const { lang } = useI18n()
  return <div key={lang} style={{ display: 'contents' }}>{children}</div>
}
