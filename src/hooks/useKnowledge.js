import { useCallback, useEffect, useRef, useState } from 'react'
import { knowledgeService } from '../services/knowledgeService.js'

export default function useKnowledge() {
  const [state, setState] = useState({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)
  const [pendingTopics, setPendingTopics] = useState({})
  const [topicErrors, setTopicErrors] = useState({})
  const lifecycle = useRef(null)
  const writes = useRef(new Map())
  const readVersion = useRef(0)
  const read = useCallback(async signal => {
    const version = ++readVersion.current
    const data = await knowledgeService.getKnowledgeState({ signal })
    if (!signal.aborted && version === readVersion.current) setState({ status: data.topics.length ? 'loaded' : 'empty', data })
    return data
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try { await read(controller.signal) }
      catch (error) { if (!controller.signal.aborted) setState({ status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', data: null }) }
    })
    return () => controller.abort()
  }, [attempt, read])
  const retry = () => {
    lifecycle.current?.abort()
    writes.current.clear()
    setPendingTopics({})
    setTopicErrors({})
    setState({ status: 'loading', data: null })
    setAttempt(value => value + 1)
  }
  const updateSelfReport = async (id, level) => {
    const controller = lifecycle.current
    const topic = state.data?.topics.find(topic => topic.id === id)
    if (!controller || controller.signal.aborted || !topic || writes.current.has(id) || !state.data.capabilities.updateSelfReport) return { success: false }
    if (topic.selfReportedLevel === level) return { success: true, level }
    writes.current.set(id, controller)
    setPendingTopics(current => ({ ...current, [id]: true }))
    setTopicErrors(current => ({ ...current, [id]: '' }))
    let confirmed = false
    try {
      await knowledgeService.updateSelfReportedLevel(id, level, { enabled: true, signal: controller.signal })
      confirmed = true
      const data = await read(controller.signal)
      if (data.topics.find(topic => topic.id === id)?.selfReportedLevel !== level) throw Error('Self-report reconciliation failed')
      return { success: true, level }
    } catch {
      if (!controller.signal.aborted) setTopicErrors(current => ({ ...current, [id]: confirmed ? 'The rating was saved, but the latest profile could not be confirmed. Retry to refresh.' : 'Could not save your self-report. The previous rating has been restored.' }))
      return { success: false, level: topic.selfReportedLevel }
    } finally {
      if (writes.current.get(id) === controller) writes.current.delete(id)
      if (!controller.signal.aborted) setPendingTopics(current => ({ ...current, [id]: false }))
    }
  }
  return { ...state, retry, pendingTopics, topicErrors, updateSelfReport }
}
