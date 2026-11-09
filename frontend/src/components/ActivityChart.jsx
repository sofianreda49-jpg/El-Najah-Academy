import { useI18n } from '../i18n/index.jsx'

/* رسم أعمدة بسيط لمجموعتين من الأرقام على 7 أيام (من غير مكتبات).
   data: [{ day: '2026-10-01', lessons_completed, attempts }] */
export default function ActivityChart({ data, labelA, labelB }) {
  const { lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const max = Math.max(1, ...data.flatMap((d) => [d.lessons_completed, d.attempts]))
  const height = (n) => (n === 0 ? '2px' : `${Math.max(4, (n / max) * 100)}%`)
  const summary = data.map((d) => `${d.day}: ${labelA} ${d.lessons_completed}, ${labelB} ${d.attempts}`).join('; ')

  return (
    <div className="activity-chart">
      <div className="chart-plot" role="img" aria-label={summary}>
        {data.map((d) => (
          <div className="chart-col" key={d.day}>
            <div className="chart-bars">
              <span className="bar bar-a" style={{ height: height(d.lessons_completed) }}
                    title={`${labelA}: ${d.lessons_completed}`} />
              <span className="bar bar-b" style={{ height: height(d.attempts) }}
                    title={`${labelB}: ${d.attempts}`} />
            </div>
            <span className="chart-label">
              {new Date(`${d.day}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span><i className="dot a" />{labelA}</span>
        <span><i className="dot b" />{labelB}</span>
      </div>
    </div>
  )
}
