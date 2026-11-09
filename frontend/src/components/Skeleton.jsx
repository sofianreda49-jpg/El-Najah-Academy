export default function Skeleton({ w = '100%', h = 16, r }) {
  return <div className="skeleton-box" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
}
