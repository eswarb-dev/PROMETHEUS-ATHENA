import { useState } from 'react'
import useSnapshot from './useSnapshot.js'
import { queryKeys } from '../lib/query/queryKeys.js'
import { progressService } from '../services/progressService.js'
export default function useProgress() {
  const [range, setRange] = useState('7d')
  const state = useSnapshot(id => queryKeys.progress(id, range), () => progressService.getProgressState({ range }), { empty: data => !data?.hasData })
  return { ...state, selectedRange: range, changeRange: setRange, refresh: state.retry, refreshing: state.query.isFetching && !state.query.isPending, refreshError: state.query.isError && !!state.data }
}
