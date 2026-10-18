import { useEffect, useRef, useState } from 'react'
import { athenaService } from '../services/athenaService.js'

const mergeMessages = (current, incoming) => {
  const merged = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => merged.set(message.id, message))
  return [...merged.values()]
}
export default function useAthena() {
  const [state, setState] = useState({ status: 'loading', capabilities: null, conversation: null, messages: [] })
  const [attempt, setAttempt] = useState(0)
  const [agentStatus, setAgentStatus] = useState('pending')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeMessageId, setActiveMessageId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const lifecycle = useRef(null)
  const operation = useRef(null)
  const requestId = useRef(null)
  const conversationRef = useRef(null)
  const started = useRef(0)
  const generation = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try {
        const capabilities = await athenaService.getCapabilities({ signal: controller.signal })
        if (controller.signal.aborted) return
        if (!capabilities.chat) { setState({ status: 'disabled', capabilities, conversation: null, messages: [] }); return }
        const conversations = await athenaService.getConversations({ signal: controller.signal })
        const conversation = conversations.toSorted((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
        const messages = conversation ? await athenaService.getMessages(conversation.id, { signal: controller.signal }) : []
        if (controller.signal.aborted) return
        conversationRef.current = conversation
        setState({ status: 'loaded', capabilities, conversation, messages })
        const last = messages.findLast(message => message.role === 'assistant')
        setAgentStatus(last && ['done', 'failed', 'cancelled'].includes(last.status) ? last.status : 'pending')
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: error.code === 'DATA_SOURCE_NOT_CONFIGURED' ? 'unavailable' : 'error', capabilities: null, conversation: null, messages: [] })
      }
    })
    return () => { controller.abort(); operation.current?.abort() }
  }, [attempt])
  const retry = () => {
    generation.current++
    lifecycle.current?.abort(); operation.current?.abort(); operation.current = null
    conversationRef.current = null; requestId.current = null
    setBusy(false); setNotice(''); setAgentStatus('pending'); setActiveMessageId(null)
    setState({ status: 'loading', capabilities: null, conversation: null, messages: [] }); setAttempt(value => value + 1)
  }
  const run = async (content, retryTarget) => {
    if (operation.current || lifecycle.current?.signal.aborted || state.status !== 'loaded' || !state.capabilities.chat || (!retryTarget && !content.trim())) return false
    const controller = new AbortController()
    operation.current = controller; requestId.current = null
    const startedAt = performance.now()
    started.current = startedAt
    generation.current++
    const current = () => operation.current === controller && !controller.signal.aborted && !lifecycle.current.signal.aborted
    setBusy(true); setNotice(''); setAgentStatus('running')
    const apply = snapshot => {
      if (!current()) return
      requestId.current = snapshot.requestId
      setActiveMessageId(snapshot.messages.findLast(message => message.role === 'assistant')?.id ?? null)
      setElapsed((performance.now() - startedAt) / 1000)
      setState(value => ({ ...value, messages: mergeMessages(value.messages, snapshot.messages) }))
    }
    try {
      if (!conversationRef.current) {
        const conversation = await athenaService.createConversation({ signal: controller.signal })
        if (!current()) return false
        conversationRef.current = conversation
        setState(value => ({ ...value, conversation }))
      }
      const id = conversationRef.current.id
      const snapshot = retryTarget ? await athenaService[retryTarget.kind === 'call' ? 'retryCall' : 'retryMessage'](retryTarget.id, id, { signal: controller.signal }) : await athenaService.sendMessage(id, { content }, { signal: controller.signal, streaming: state.capabilities.streaming, onSnapshot: apply })
      if (!current()) return false
      apply(snapshot)
      const assistant = snapshot.messages.findLast(message => message.role === 'assistant')
      if (!assistant || !['done', 'failed', 'cancelled'].includes(assistant.status)) throw Error('Incomplete response')
      setAgentStatus(assistant.status)
      if (assistant.status === 'failed') setNotice('Response failed. Your saved messages remain below.')
      return true
    } catch {
      if (current()) {
        setAgentStatus('failed'); setNotice('Response failed. Your prompt is kept in the composer. Check saved messages before sending again.')
        if (conversationRef.current) {
          try {
            const messages = await athenaService.getMessages(conversationRef.current.id, { signal: controller.signal })
            if (current()) setState(value => ({ ...value, messages: mergeMessages(value.messages, messages) }))
          } catch { if (current()) setNotice('Response failed, and saved messages could not be refreshed. Reload ATHENA before sending again.') }
        }
      }
      return false
    } finally { if (operation.current === controller) { operation.current = null; if (!lifecycle.current.signal.aborted) setBusy(false) } }
  }
  const stop = async () => {
    const active = operation.current
    if (!active) return
    const id = requestId.current
    const stoppedGeneration = generation.current
    active.abort(); operation.current = null
    setElapsed((performance.now() - started.current) / 1000)
    setBusy(false); setAgentStatus('cancelled')
    setNotice('Stopped this request locally. Backend cancellation has not been confirmed.')
    if (state.capabilities.stop && id) {
      try {
        await athenaService.stopResponse(id, { signal: lifecycle.current.signal })
        if (!lifecycle.current.signal.aborted && generation.current === stoppedGeneration) setNotice('ATHENA confirmed that this response was stopped.')
      } catch { /* The local abort remains valid even when the server cannot confirm cancellation. */ }
    }
  }
  const retryMessage = id => state.capabilities?.retryMessage ? run('', { kind: 'message', id }) : undefined
  const retryCall = id => state.capabilities?.retryCall ? run('', { kind: 'call', id }) : undefined
  return { ...state, agentStatus, busy, notice, activeMessageId, elapsed, retry, send: content => run(content), stop, retryMessage, retryCall }
}
