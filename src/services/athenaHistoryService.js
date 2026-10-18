import { rpc } from '../lib/supabase/request.js'
export const athenaHistoryService = { getHistory: options => rpc('get_athena_snapshot', {}, options) }
