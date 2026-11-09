const KEY = 'najah_theme'

function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function currentTheme() {
  return document.documentElement.dataset.theme || 'light'
}

export function initTheme() {
  const saved = read()
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = saved || (prefersDark ? 'dark' : 'light')
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* التخزين غير متاح: مش مشكلة */
  }
  return next
}
