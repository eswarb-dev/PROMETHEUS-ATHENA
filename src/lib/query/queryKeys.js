const scope = (userId, page) => ['user', userId, page]
export const queryKeys = {
  session: ['session'], home: id => scope(id, 'home'), roadmap: id => scope(id, 'roadmap'),
  today: (id, date) => [...scope(id, 'today'), ...(date ? [date] : [])],
  knowledge: id => scope(id, 'knowledge'),
  progress: (id, range) => [...scope(id, 'progress'), ...(range ? [range] : [])],
  settings: id => scope(id, 'settings'),
  onboarding: id => scope(id, 'onboarding'),
  athenaConversation: (id, conversationId = 'latest') => [...scope(id, 'athena'), conversationId],
}
export async function invalidatePages(client, userId, pages) {
  await Promise.all(pages.map(page => client.invalidateQueries({ queryKey: queryKeys[page](userId) })))
}
