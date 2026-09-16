import type { BrowserWindow } from 'electron'
import { WATCHED_CHANGED_CHANNEL, type WatchTopic } from './watch-contract'
import { watchTrees } from './watch-paths'

// What stands behind a topic: anything that reports a change and hands back its own disposer. Trees
// on disk are one such source; a Permission is another, and it touches no file, so the source shape
// is the subscription rather than a list of roots.
export type WatchedSource = (changed: () => void) => () => void

export type WatchedTopics = Partial<Record<WatchTopic, WatchedSource>>

// A topic whose change is a write under one of these trees.
export function watchedTrees(roots: readonly string[]): WatchedSource {
  return (changed) => watchTrees(roots, changed).close
}

// Tells one window that a body of data it may be showing has changed underneath it. This replaces
// polling: the roster used to re-read every transcript file twice a second to notice a Session that
// had been written by a CLI outside Argo, and the Session screen asked twice a second whether a
// Permission was waiting.
export function registerWatching(window: BrowserWindow, topics: WatchedTopics) {
  const closers = Object.entries(topics).map(([topic, source]) =>
    source(() => {
      if (window.isDestroyed()) return
      window.webContents.send(WATCHED_CHANGED_CHANNEL, topic)
    }),
  )
  window.on('closed', () => {
    for (const close of closers) close()
  })
}
