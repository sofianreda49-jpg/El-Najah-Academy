import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { I18nProvider, LanguageKey } from './i18n/index.jsx'
import { initTheme } from './theme.js'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/student.css'
import './styles/exam.css'
import './styles/parent.css'
import './styles/teacher.css'
import './styles/app2.css'
import './styles/design.css'

initTheme()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <LanguageKey>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </LanguageKey>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
)

// تثبيت المنصة كتطبيق: الـ service worker بيتسجّل في النسخة المنشورة بس (مش وقت التطوير)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
