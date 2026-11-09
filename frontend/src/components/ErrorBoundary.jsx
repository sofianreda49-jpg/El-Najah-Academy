import { Component } from 'react'
import { tr } from '../i18n/index.jsx'

// بيمنع "الصفحة البيضا": لو حصل خطأ في العرض بيظهر رسالة بدل شاشة فاضية
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="auth-single">
        <div className="auth-card">
          <h2>{tr("حصلت مشكلة في عرض الصفحة")}</h2>
          <p className="muted">{tr("جرّب تعيد تحميل الصفحة. ولو المشكلة استمرت ابعت النص اللي تحت للدعم.")}</p>
          <pre
            style={{
              direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 180,
              overflow: 'auto', padding: 10, borderRadius: 8, background: 'var(--surface-2)',
            }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn btn-primary btn-block" type="button" onClick={() => window.location.reload()}>{tr("إعادة تحميل الصفحة")}</button>
        </div>
      </div>
    )
  }
}
