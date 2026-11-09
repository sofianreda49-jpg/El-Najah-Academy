import { useEffect, useState } from 'react'

// بيشغّل دالة جلب بيانات ويرجّع { data, loading, error, reload }
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: '' }))
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}
