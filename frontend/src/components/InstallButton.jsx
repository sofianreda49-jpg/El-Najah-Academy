import { useEffect, useState } from 'react'

import Icon from './Icon.jsx'
import { tr } from '../i18n/index.jsx'

// بيظهر بس لما المتصفح يسمح بالتثبيت (كروم على أندرويد وسطح المكتب).
// على iPhone: مشاركة (Share) ← "إضافة إلى الشاشة الرئيسية".
export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!promptEvent) return null

  async function install() {
    promptEvent.prompt()
    await promptEvent.userChoice.catch(() => {})
    setPromptEvent(null)
  }

  return (
    <button className="nav-link" type="button" onClick={install}>
      <Icon name="plus" />
      <span>{tr("تثبيت التطبيق")}</span>
    </button>
  )
}
