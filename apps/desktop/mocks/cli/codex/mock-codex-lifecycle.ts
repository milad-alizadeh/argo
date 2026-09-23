type Send = (message: Record<string, unknown>) => void
const LIFECYCLE_NOTIFICATION_DELAY_MS = 25

export function scheduleThreadLifecycle(text: string, threadId: unknown, send: Send): boolean {
  if (text.includes('NOT_LOADED')) {
    setTimeout(() => {
      send({
        method: 'thread/status/changed',
        params: { threadId, status: { type: 'notLoaded' } },
      })
    }, LIFECYCLE_NOTIFICATION_DELAY_MS)
    return true
  }
  if (text.includes('CLOSED')) {
    setTimeout(() => {
      send({
        method: 'thread/closed',
        params: { threadId },
      })
    }, LIFECYCLE_NOTIFICATION_DELAY_MS)
    return true
  }
  return false
}
