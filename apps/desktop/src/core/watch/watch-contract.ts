// What the main process can tell the renderer has changed on disk. A topic names a body of data,
// never a path: the renderer knows it must read the roster again, and nothing about where Sessions
// are stored.
export const WATCHED_CHANGED_CHANNEL = 'argo:watch:changed'

export const WATCH_TOPICS = ['sessions'] as const

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
