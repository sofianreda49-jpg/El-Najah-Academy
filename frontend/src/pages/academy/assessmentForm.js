import { tr } from '../../i18n/index.jsx'
export const KIND_LABELS = { get quiz() { return tr("اختبار قصير") }, get exam() { return tr("امتحان") } }
export const KIND_OPTIONS = [
  { value: 'quiz', label: KIND_LABELS.quiz },
  { value: 'exam', label: KIND_LABELS.exam },
]
export const ASSESSMENT_DEFAULTS = {
  kind: 'quiz', passing_score: 50, max_attempts: 1, show_answers: true,
}

// حقول نموذج إعدادات الاختبار (lessonOptions اختياري: لو فاضي مبنعرضش حقل الدرس)
export function assessmentFields(lessonOptions = []) {
  const fields = [
    { name: 'title', label: tr("عنوان الاختبار"), required: true },
    { name: 'description', label: tr("تعليمات للطالب"), type: 'textarea', rows: 3 },
    { name: 'kind', label: tr("النوع"), type: 'select', required: true, options: KIND_OPTIONS },
  ]
  if (lessonOptions.length) {
    fields.push({ name: 'lesson_id', label: tr("مرتبط بدرس (اختياري)"), type: 'select', options: lessonOptions })
  }
  fields.push(
    { name: 'time_limit_minutes', label: tr("المدة بالدقائق"), type: 'number', min: 1, help: tr("اتركه فاضي لو مفيش وقت محدد.") },
    { name: 'passing_score', label: tr("درجة النجاح (%)"), type: 'number', min: 0, required: true },
    { name: 'max_attempts', label: tr("عدد المحاولات المسموحة"), type: 'number', min: 1, required: true },
    { name: 'show_answers', label: tr("إظهار الإجابات الصحيحة بعد التسليم"), type: 'checkbox' },
    { name: 'shuffle_questions', label: tr("ترتيب الأسئلة عشوائي لكل طالب"), type: 'checkbox' },
    { name: 'shuffle_choices', label: tr("ترتيب الاختيارات عشوائي"), type: 'checkbox' },
  )
  return fields
}

// بيحوّل قيم النموذج لجسم الطلب (null صريح بيمسح الحقول الاختيارية)
export function assessmentBody(v) {
  const body = {
    title: v.title,
    description: v.description ?? null,
    kind: v.kind,
    time_limit_minutes: v.time_limit_minutes ?? null,
    passing_score: v.passing_score,
    max_attempts: v.max_attempts,
    show_answers: !!v.show_answers,
    shuffle_questions: !!v.shuffle_questions,
    shuffle_choices: !!v.shuffle_choices,
  }
  if ('lesson_id' in v) body.lesson_id = v.lesson_id ? Number(v.lesson_id) : null
  return body
}
