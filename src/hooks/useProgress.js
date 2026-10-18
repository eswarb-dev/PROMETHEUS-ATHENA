import { useCallback, useEffect, useRef, useState } from 'react'
import { progressService } from '../services/progressService.js'

export default function useProgress() {
  const [state, setState] = useState({ status: 'loading', data: null, refreshing: false, refreshError: false })
  const [query, setQuery] = useState({ range: undefined, attempt: 0 })
  const request = useRef(null)
  const version = useRef(0)
  const read = useCallback(async (controller, range, retain) => {
    const current = ++version.current
    try {
      const data = range ? await progressService.getProgressRange(range, { enabled: true, signal: controller.signal }) : await progressService.getProgressState({ signal: controller.signal })
      if (!controller.signal.aborted && current === version.current) setState({ status: data.hasData ? 'loaded' : 'empty', data, refreshing: false, refreshError: false })
    } catch (error) {
      if (!controller.signal.aborted && current === version.current) setState(value => retain ? { ...value, refreshing: false, refreshError: true } : { status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', data: null, refreshing: false, refreshError: false })
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    Promise.resolve().then(() => { if (!controller.signal.aborted) read(controller, query.range, false) })
    return () => { controller.abort(); request.current?.abort() }
  }, [query, read])
  const changeRange = range => {
    if (!state.data?.capabilities.rangeQueries || !['7d', '30d', '90d'].includes(range) || (query.range ?? state.data.range) === range) return
    request.current?.abort()
    setState(value => ({ ...value, status: 'loading', refreshing: false, refreshError: false }))
    setQuery(value => ({ range, attempt: value.attempt + 1 }))
  }
  const refresh = () => {
    if (state.refreshing) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState(value => ({ ...value, refreshing: true, refreshError: false }))
    read(controller, state.data?.capabilities.rangeQueries ? query.range : undefined, true)
  }
  const retry = () => { request.current?.abort(); setState(value => ({ ...value, status: 'loading', refreshing: false, refreshError: false })); setQuery(value => ({ ...value, attempt: value.attempt + 1 })) }
  return { ...state, selectedRange: query.range ?? state.data?.range ?? '7d', changeRange, refresh, retry }
}
