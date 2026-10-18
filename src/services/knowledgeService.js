import { supabase } from '../lib/supabase/client.js'
import { rpc } from '../lib/supabase/request.js'
import { DataError, normalizeError } from '../lib/supabase/errors.js'
import { selfReportedLevels } from '../domain/studyPreferences.js'
import { sessionIdentity } from '../lib/auth/sessionIdentity.js'
export const knowledgeService = {
  getKnowledgeState: options => rpc('get_knowledge_snapshot', {}, options),
  async updateSelfReportedLevel(id, level, { userId } = {}) {
    if (!supabase) throw new DataError('SUPABASE_NOT_CONFIGURED')
    if (!userId) throw new DataError('AUTH_REQUIRED')
    if (!selfReportedLevels.includes(level)) throw new DataError('QUERY_ERROR')
    const { data, error } = await supabase.from('knowledge_topics').update({ self_reported_level: level }).eq('id', id).eq('user_id', userId).select('id,self_reported_level').single().abortSignal(sessionIdentity.signal)
    if (error) throw normalizeError(error)
    return data
  },
}
