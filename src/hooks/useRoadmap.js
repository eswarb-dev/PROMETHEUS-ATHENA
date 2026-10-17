import { useCallback, useEffect, useState } from 'react'
import { roadmapService } from '../services/roadmapService.js'

export default function useRoadmap() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  useEffect(() => {
    const controller = new AbortController()
    // Defer until StrictMode's discarded mount has had a chance to abort.
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try {
        const data = await roadmapService.loadActiveRoadmap({ signal: controller.signal })
        if (!controller.signal.aborted) setState({ status: data ? 'loaded' : 'empty', data })
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', data: null })
      } finally {
        controller.abort()
      }
    })
    return () => controller.abort()
  }, [attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading', data: null })
    setAttempt(value => value + 1)
  }, [])
  return { ...state, retry }
}
