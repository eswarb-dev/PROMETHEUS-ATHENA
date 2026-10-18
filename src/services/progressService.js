import { rpc } from '../lib/supabase/request.js'
export const progressService = {
  async getProgressState({ range = '7d', ...options } = {}) {
    const data = await rpc('get_progress_snapshot', { p_range: range }, options)
    return { ...data, hasData: data.hasHistory || data.summary.knowledgeTotal > 0 }
  },
}
