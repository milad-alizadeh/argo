import type { BrowserWindow } from 'electron'
import { WATCHED_CHANGED_CHANNEL, type WatchTopic } from './watch-contract'
import type { WatchedSource } from './watch-source'

// What stands behind each topic. A tree watch is the usual source, and a topic may name several: a
// module that wants its own topic adds its sources here and names the topic in `WATCH_TOPICS`.
export type WatchedTopics = Partial<Record<WatchTopic, readonly WatchedSource[]>>

// Tells one window that a body of data it may be showing has changed underneath it. This replaces
// polling: the roster used to re-read every transcript file twice a second to notice a Session that
// had been written by a CLI outside Argo.
export function registerWatching(window: BrowserWindow, topics: WatchedTopics) {
  const watched = Object.entries(topics).flatMap(([topic, sources]) =>
    sources.map((source) =>
      source(() => {
        if (window.isDestroyed()) return
        window.webContents.send(WATCHED_CHANGED_CHANNEL, topic)
      }),
    ),
  )
  window.on('closed', () => {
    for (const subscription of watched) subscription.close()
  })
}
