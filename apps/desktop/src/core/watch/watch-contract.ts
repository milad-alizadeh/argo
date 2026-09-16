// What the main process can tell the renderer has changed. A topic names a body of data, never a
// path: the renderer knows it must read the roster again, and nothing about where Sessions are
// stored. Not every topic is a file either. A Permission lives in main-process memory, and the
// renderer reads it back the same way whichever it is.
export const WATCHED_CHANGED_CHANNEL = 'argo:watch:changed'

export const WATCH_TOPICS = ['permissions', 'sessions'] as const

export type WatchTopic = (typeof WATCH_TOPICS)[number]

export function isWatchTopic(value: unknown): value is WatchTopic {
  return typeof value === 'string' && (WATCH_TOPICS as readonly string[]).includes(value)
}

// Mirrors the appearance client: a subscription that hands back its own disposer, so a remounted
// component cannot leave a listener behind.
export function createWatchClient(subscribe: (listener: (topic: unknown) => void) => () => void) {
  return {
    onWatchedChanged(listener: (topic: WatchTopic) => void) {
      return subscribe((topic) => {
        if (isWatchTopic(topic)) listener(topic)
      })
    },
  }
}
