import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import { useToast } from './Toast.jsx'
import { tr } from '../i18n/index.jsx'

/* بيعرض بيانات الدخول المؤقتة مرة واحدة بعد الإنشاء أو إعادة التعيين */
export default function CredentialsModal({ data, onClose }) {
  const toast = useToast()
  if (!data) return null

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(tr("تم النسخ"))
    } catch {
      toast.error(tr("تعذر النسخ. انسخ النص يدوياً."))
    }
  }

  const rows = [
    [tr("البريد الإلكتروني"), data.email],
    [tr("كلمة المرور المؤقتة"), data.password],
  ]

  return (
    <Modal title={tr("تم بنجاح")} onClose={onClose}
           footer={<button className="btn btn-primary" type="button" onClick={onClose}>{tr("تم")}</button>}>
      {data.name && <p><strong>{data.name}</strong></p>}
      <div className="alert alert-warn">{tr("سلّم هذه البيانات للمستخدم الآن. لن تتمكن من رؤية كلمة المرور مرة أخرى، وسيُطلب منه تغييرها عند أول دخول.")}</div>
      <div className="credentials">
        {rows.map(([label, value]) => (
          <div className="cred-row" key={label}>
            <div>
              <small className="muted">{label}</small>
              <div><code>{value}</code></div>
            </div>
            <button className="icon-btn" type="button" onClick={() => copy(value)} aria-label={tr("نسخ {label}", { label })}>
              <Icon name="copy" size={18} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
