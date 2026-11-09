import { ENGLISH_ENABLED, useI18n } from '../i18n/index.jsx'
import { tr } from '../i18n/index.jsx'

// ظاهر بس لما الإنجليزي مفعّل (VITE_ENABLE_ENGLISH=true)
export default function LanguageSwitch() {
  const { lang, setLang } = useI18n()
  if (!ENGLISH_ENABLED) return null
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>{tr("العربية")}</button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
    </div>
  )
}
