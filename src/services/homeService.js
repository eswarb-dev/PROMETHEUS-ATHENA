import { rpc } from '../lib/supabase/request.js'
export const homeService = { getHomeSnapshot: options => rpc('get_home_snapshot', {}, options) }
