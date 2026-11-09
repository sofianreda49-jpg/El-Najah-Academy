import { useState } from 'react'
import Modal from './Modal.jsx'
import { tr } from '../i18n/index.jsx'

/* config = { _id, title, message, confirmLabel, danger, onConfirm: async () => {...} } */
export default function ConfirmDialog({ config, onClose }) {
  if (!config) return null
  return <ConfirmBody key={config._id} config={config} onClose={onClose} />
}

function ConfirmBody({ config, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await config.onConfirm()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={config.title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>{tr("إلغاء")}</button>
          <button className={`btn ${config.danger ? 'btn-danger' : 'btn-primary'}`} type="button"
                  onClick={confirm} disabled={busy}>
            {busy ? tr("جاري التنفيذ...") : config.confirmLabel || tr("تأكيد")}
          </button>
        </>
      }
    >
      <p>{config.message}</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
    </Modal>
  )
}
