// What the main process can tell the renderer has changed. A topic names a body of data, never a
// path or a source: the renderer knows it must read the roster again, and nothing about where
// Sessions are stored or which of the topic's sources spoke.
export const WATCHED_CHANGED_CHANNEL = 'argo:watch:changed'

// `sessions` is fed by the transcript trees the CLIs write to. `permissions` is fed by each drive
// adapter instead, because a Permission arrives over the adapter's own channel and touches no tree.
export const WATCH_TOPICS = ['sessions', 'permissions'] as const

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
