import { getLocale } from '../i18n/index.jsx'

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}
