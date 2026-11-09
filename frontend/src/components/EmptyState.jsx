import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'sparkle', title, text, action }) {
  return (
    <div className="card empty-block">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
