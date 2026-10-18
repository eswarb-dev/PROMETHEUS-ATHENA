import { useMutation, useQueryClient } from '@tanstack/react-query'
import useSnapshot from './useSnapshot.js'
import { queryKeys, invalidatePages } from '../lib/query/queryKeys.js'
import { roadmapService } from '../services/roadmapService.js'
export default function useRoadmap() {
  const state = useSnapshot(queryKeys.roadmap, () => roadmapService.loadActiveRoadmap(), { empty: data => !data })
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: ({ id, status }) => roadmapService.updateTopicStatus(id, status, state.user?.id), onSuccess: () => invalidatePages(client, state.user.id, ['roadmap', 'home', 'progress']) })
  return { ...state, updateTopic: mutation.mutateAsync }
}
