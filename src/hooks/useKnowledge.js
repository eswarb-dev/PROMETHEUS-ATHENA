import useSnapshot from './useSnapshot.js'
import useWrite from './useWrite.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { knowledgeService } from '../services/knowledgeService.js'
export default function useKnowledge() {
  const state = useSnapshot(queryKeys.knowledge, () => knowledgeService.getKnowledgeState(), { empty: data => !data?.topics.length })
  const writes = useWrite(['knowledge', 'home'])
  return { ...state, pendingTopics: writes.pending, topicErrors: writes.errors,
    updateSelfReport: async (id, level) => ({ success: await writes.write(id, userId => knowledgeService.updateSelfReportedLevel(id, level, { userId })), level }),
  }
}
