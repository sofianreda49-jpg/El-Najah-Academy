// مفتاح تحية حسب الوقت (يتترجم بـ t())
export function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'student.greeting.morning'
  if (h < 18) return 'student.greeting.afternoon'
  return 'student.greeting.evening'
}
