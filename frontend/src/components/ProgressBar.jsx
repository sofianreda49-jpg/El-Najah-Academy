export default function ProgressBar({ done, total }) {
  const percent = total ? Math.round((done * 100) / total) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}
