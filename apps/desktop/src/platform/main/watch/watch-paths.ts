import { watch } from 'node:fs'
import type { WatchedSource } from './watch-source'

// How long a burst of filesystem events is allowed to settle before one change is announced.
// A Harness writing a transcript emits an event per appended chunk, so without this the renderer would
// be told to read again several times a second while a Session is being written to.
export const SETTLE_MS = 400

// How long to wait before opening a root again, by attempt. The last entry repeats forever, because
// a root that does not exist is not a failure: a reader who installs a Harness after Argo started gets
// the watch on that tree within this delay rather than on the next restart.
export const REOPEN_DELAYS_MS = [50, 250, 1_000, 5_000, 30_000] as const

// How long a watch has to hold before the next failure is treated as a fresh one rather than the
// next step of the same flap. Longer than the last delay, so a root that reopens and dies again
// keeps climbing instead of resetting.
export const HEALTHY_MS = 60_000

// What `watchTrees` needs of one open watch. A test hands its own, because an `error` from a real
// recursive watch cannot be provoked: deleting the watched root emits an ordinary change event and
// leaves the handle working (probed on macOS 26).
export type WatchedHandle = {
  close: () => void
  on: (event: 'error', listener: () => void) => unknown
}

export type WatchOpener = (root: string, onEvent: () => void) => WatchedHandle

const openRecursiveWatch: WatchOpener = (root, onEvent) =>
  watch(root, { persistent: false, recursive: true }, onEvent)

// One recursive watch per root. On macOS `recursive` is served by FSEvents, so the kernel pushes
// changes and nothing here walks or stats the tree: the cost is a subscription, not a poll.
//
// FSEvents can also lose events with no error and no closed handle, for example across an unmount or
// a sleep, so the topic keeps other sources beside this one (watch-source.ts).
export function watchTrees(
  roots: readonly string[],
  open: WatchOpener = openRecursiveWatch,
): WatchedSource {
  return (onChanged) => {
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

    const opened = roots.map((root) => keepWatched(root, announce, open))
    return () => {
      closed = true
      if (settling !== null) clearTimeout(settling)
      for (const root of opened) root.close()
    }
  }
}

// Keeps one root watched for as long as the caller holds it. A watcher that errors is dead, and so
// is a root that was not there to open, so both take the same path: wait, open again, and announce,
// because whatever happened to the tree while it was blind was never reported.
function keepWatched(root: string, announce: () => void, open: WatchOpener) {
  let watcher: WatchedHandle | null = null
  let reopening: ReturnType<typeof setTimeout> | null = null
  let healthy: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let closed = false

  const openNow = (announceOnOpen: boolean) => {
    if (closed) return
    try {
      const opened = open(root, announce)
      opened.on('error', () => {
        opened.close()
        if (watcher === opened) watcher = null
        if (healthy !== null) clearTimeout(healthy)
        healthy = null
        reopenLater()
      })
      watcher = opened
      // The backoff starts over only once this watch has held, never on the open itself: a watch
      // that dies as soon as it opens would otherwise repeat the first delay forever, and every
      // reopen announces, so the flap would read the trees harder than any poll (#2303).
      healthy = setTimeout(() => {
        attempt = 0
      }, HEALTHY_MS)
      healthy.unref?.()
      if (announceOnOpen) announce()
    } catch {
      reopenLater()
    }
  }

  const reopenLater = () => {
    if (closed || reopening !== null) return
    const delay = REOPEN_DELAYS_MS[Math.min(attempt, REOPEN_DELAYS_MS.length - 1)]
    attempt += 1
    reopening = setTimeout(() => {
      reopening = null
      openNow(true)
    }, delay)
    reopening.unref?.()
  }

  openNow(false)
  return {
    close: () => {
      closed = true
      if (reopening !== null) clearTimeout(reopening)
      if (healthy !== null) clearTimeout(healthy)
      watcher?.close()
    },
  }
}
