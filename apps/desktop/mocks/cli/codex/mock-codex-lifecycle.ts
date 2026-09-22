type Send = (message: Record<string, unknown>) => void

export function scheduleThreadLifecycle(text: string, threadId: unknown, send: Send): boolean {
  if (text.includes('NOT_LOADED')) {
    setTimeout(() => {
      send({
        method: 'thread/status/changed',
        params: { threadId, status: { type: 'notLoaded' } },
      })
    }, 1)
    return true
  }
  if (text.includes('CLOSED')) {
    setTimeout(() => {
      send({
        method: 'thread/closed',
        params: { threadId },
      })
    }, 1)
    return true
  }
  return false
}
