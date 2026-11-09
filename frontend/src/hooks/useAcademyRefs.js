import { api } from '../api/client.js'
import { useApi } from './useApi.js'

// بيانات مرجعية بتتستخدم في أكتر من شاشة (أسماء الصفوف والأترام والمواد)
export function useAcademyRefs() {
  const { data, loading, error, reload } = useApi(async () => {
    const [grades, years, terms, subjects] = await Promise.all([
      api('/academy/grades'),
      api('/academy/academic-years'),
      api('/academy/terms'),
      api('/academy/subjects'),
    ])
    const gradeById = Object.fromEntries(grades.map((g) => [g.id, g]))
    const yearById = Object.fromEntries(years.map((y) => [y.id, y]))
    const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s]))
    const termLabel = (termId) => {
      const t = terms.find((x) => x.id === termId)
      if (!t) return '—'
      return `${yearById[t.academic_year_id]?.name ?? ''} — ${t.name}`
    }
    return {
      grades, years, terms, subjects,
      gradeName: (id) => gradeById[id]?.name ?? '—',
      subjectName: (id) => subjectById[id]?.name ?? '—',
      termLabel,
    }
  }, [])
  return { refs: data, loading, error, reload }
}
