import type { BrowserWindow } from 'electron'
import type { WatchedSource } from '@/platform/main/watch/watch-source'
import { WATCHED_CHANGED_CHANNEL, type WatchTopic } from '@/platform/shared/watch'

// What stands behind each topic. Trees on disk are the usual source, a Permission in main-process
// memory is another, and a topic may name several: a module that wants its own topic adds its
// sources here and names the topic in `WATCH_TOPICS`.
export type WatchedTopics = Partial<Record<WatchTopic, readonly WatchedSource[]>>

// Tells one window that a body of data it may be showing has changed underneath it. This replaces
// polling: the roster used to re-read every transcript file twice a second to notice a Session that
// had been written by a CLI outside Argo, and the Session screen asked twice a second whether a
// Permission was waiting.
export function registerWatching(window: BrowserWindow, topics: WatchedTopics) {
  const closers = Object.entries(topics).flatMap(([topic, sources]) =>
    sources.map((source) =>
      source(() => {
        if (window.isDestroyed()) return
        window.webContents.send(WATCHED_CHANGED_CHANNEL, topic)
      }),
    ),
  )
  window.on('closed', () => {
    for (const close of closers) close()
  })
}
