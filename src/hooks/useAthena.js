import useSnapshot from './useSnapshot.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { athenaHistoryService } from '../services/athenaHistoryService.js'
export default function useAthena() {
  const state = useSnapshot(queryKeys.athenaConversation, () => athenaHistoryService.getHistory())
  return { ...state, messages: state.data?.messages ?? [], agentStatus: 'pending', busy: false, capabilities: { chat: false, sources: [], commandOptions: [] }, notice: 'ATHENA reasoning is not connected yet. Saved conversations are read-only.' }
}
