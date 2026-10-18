let userId = null
let controller = new AbortController()
export const sessionIdentity = {
  get userId() { return userId },
  get signal() { return controller.signal },
  change(nextId) {
    if (nextId === userId) return
    controller.abort()
    controller = new AbortController()
    userId = nextId
  },
}
