import { useCallback, useEffect, useRef, useState } from 'react'
import { todayService } from '../services/todayService.js'

export default function useToday() {
  const [state, setState] = useState({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)
  const [pendingTasks, setPendingTasks] = useState({})
  const [taskErrors, setTaskErrors] = useState({})
  const [sessionPending, setSessionPending] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const lifecycle = useRef(null)
  const pending = useRef(new Map())
  const focusPending = useRef(false)
  const readVersion = useRef(0)
  const read = useCallback(async signal => {
    const version = ++readVersion.current
    const data = await todayService.getTodayPlan({ signal })
    if (!signal.aborted && version === readVersion.current) setState({ status: data.tasks.length ? 'loaded' : 'empty', data })
    return data
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try { await read(controller.signal) }
      catch (error) {
        if (!controller.signal.aborted) setState({ status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', data: null })
      }
    })
    return () => controller.abort()
  }, [attempt, read])

  const retry = () => {
    lifecycle.current?.abort()
    pending.current.clear()
    focusPending.current = false
    setPendingTasks({})
    setTaskErrors({})
    setSessionPending(false)
    setSessionError('')
    setState({ status: 'loading', data: null })
    setAttempt(value => value + 1)
  }
  const updateTask = async (taskId, checked) => {
    const controller = lifecycle.current
    if (!controller || controller.signal.aborted || pending.current.has(taskId) || !state.data?.capabilities.updateTask) return
    pending.current.set(taskId, controller)
    setPendingTasks(current => ({ ...current, [taskId]: true }))
    setTaskErrors(current => ({ ...current, [taskId]: '' }))
    let saved = false
    try {
      const status = checked ? 'completed' : 'planned'
      await todayService.updateTaskStatus(taskId, status, { enabled: state.data.capabilities.updateTask, signal: controller.signal })
      saved = true
      const data = await read(controller.signal)
      if (data.tasks.find(task => task.id === taskId)?.status !== status) throw Error('Task reconciliation failed')
    } catch {
      if (!controller.signal.aborted) setTaskErrors(current => ({ ...current, [taskId]: saved ? "The task was saved, but today's plan could not be confirmed. Retry to refresh it." : "Couldn't update this task. Its previous status is still shown. Retry to refresh today's plan." }))
    } finally {
      if (pending.current.get(taskId) === controller) pending.current.delete(taskId)
      if (!controller.signal.aborted) setPendingTasks(current => ({ ...current, [taskId]: false }))
    }
  }
  const startSession = async taskId => {
    const controller = lifecycle.current
    const task = state.data?.tasks.find(task => task.id === taskId)
    if (!controller || controller.signal.aborted || focusPending.current || !state.data?.capabilities.focusSessions || state.data.activeSession || !task || task.status === 'completed') return
    focusPending.current = controller
    setSessionPending(true)
    setSessionError('')
    let saved = false
    try {
      const session = await todayService.startFocusSession(taskId, { enabled: state.data.capabilities.focusSessions, signal: controller.signal })
      saved = true
      const data = await read(controller.signal)
      if (data.activeSession?.id !== session.id) throw Error('Session reconciliation failed')
    } catch {
      if (!controller.signal.aborted) setSessionError(saved ? "The session was created, but its current state couldn't be confirmed. Retry to refresh today's plan." : "Couldn't start a focus session. No session has been shown as started. Try again.")
    } finally {
      if (focusPending.current === controller) focusPending.current = false
      if (!controller.signal.aborted) setSessionPending(false)
    }
  }
  return { ...state, retry, updateTask, pendingTasks, taskErrors, startSession, sessionPending, sessionError }
}
