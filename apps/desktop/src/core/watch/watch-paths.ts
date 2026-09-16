import { watch } from 'node:fs'

// How long a burst of filesystem events is allowed to settle before one change is announced.
// A CLI writing a transcript emits an event per appended chunk, so without this the renderer would
// be told to read again several times a second while a Session is being written to.
export const SETTLE_MS = 400

export type WatchedTree = {
  close: () => void
}

// One recursive watch per root. On macOS `recursive` is served by FSEvents, so the kernel pushes
// changes and nothing here walks or stats the tree: the cost is a subscription, not a poll.
//
// A root that does not exist is not an error. The CLI may not have been run on this machine yet, and
// a watch that cannot be opened simply reports nothing rather than failing the app's start.
export function watchTrees(roots: readonly string[], onChanged: () => void): WatchedTree {
  let settling: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const announce = () => {
    if (closed) return
    if (settling !== null) clearTimeout(settling)
    settling = setTimeout(() => {
      settling = null
      if (!closed) onChanged()
    }, SETTLE_MS)
  }

  const watchers = roots.flatMap((root) => {
    try {
      const watcher = watch(root, { persistent: false, recursive: true }, announce)
      // A watched tree can be removed while the app runs; that is a change, not a crash.
      watcher.on('error', announce)
      return [watcher]
    } catch {
      return []
    }
  })

  return {
    close: () => {
      closed = true
      if (settling !== null) clearTimeout(settling)
      for (const watcher of watchers) watcher.close()
    },
  }
}
