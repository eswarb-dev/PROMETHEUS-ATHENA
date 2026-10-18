import { rpc } from '../lib/supabase/request.js'
import { supabase } from '../lib/supabase/client.js'
import { DataError, normalizeError } from '../lib/supabase/errors.js'
import { sessionIdentity } from '../lib/auth/sessionIdentity.js'
export const roadmapService = {
  loadActiveRoadmap: options => rpc('get_roadmap_snapshot', {}, options),
  async updateTopicStatus(id, status, userId) {
    if (!supabase) throw new DataError('SUPABASE_NOT_CONFIGURED')
    if (!userId) throw new DataError('AUTH_REQUIRED')
    const { data, error } = await supabase.from('roadmap_topics').update({ status }).eq('id', id).select('id,status').single().abortSignal(sessionIdentity.signal)
    if (error) throw normalizeError(error)
    return data
  },
}
