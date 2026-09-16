import type { BrowserWindow } from 'electron'
import { WATCHED_CHANGED_CHANNEL, type WatchTopic } from './watch-contract'
import { watchTrees } from './watch-paths'

// Which trees stand behind each topic. A module that wants its own topic adds its roots here and
// names the topic in `WATCH_TOPICS`; nothing else in the watching changes.
export type WatchedTopics = Partial<Record<WatchTopic, readonly string[]>>

// Tells one window that a body of data it may be showing has changed underneath it. This replaces
// polling: the roster used to re-read every transcript file twice a second to notice a Session that
// had been written by a CLI outside Argo.
export function registerWatching(window: BrowserWindow, topics: WatchedTopics) {
  const watched = Object.entries(topics).map(([topic, roots]) =>
    watchTrees(roots, () => {
      if (window.isDestroyed()) return
      window.webContents.send(WATCHED_CHANGED_CHANNEL, topic)
    }),
  )
  window.on('closed', () => {
    for (const tree of watched) tree.close()
  })
}
