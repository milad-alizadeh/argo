import { type FSWatcher, watch } from 'node:fs'
import { join } from 'node:path'

// The incremental half of observation (ADR-0008): after the launch sweep, one recursive watch on
// the CLI transcript root tells us WHICH file moved, so a live Session is re-read on its own and
// the sweep never runs again. A machine with no transcript root yields a no-op watcher.

// A working agent appends many records a second. Coalescing them means one re-read per burst
// instead of one per line — the difference between a quiet observer and a busy loop on a laptop.
export const CHANGE_DEBOUNCE_MS = 400

export interface Watcher {
  close(): void
}

const NO_WATCHER: Watcher = { close: () => {} }

export function watchTranscripts(root: string, onChange: (path: string) => void): Watcher {
  const timers = new Map<string, NodeJS.Timeout>()
  let watcher: FSWatcher

  const schedule = (path: string): void => {
    clearTimeout(timers.get(path))
    const timer = setTimeout(() => {
      timers.delete(path)
      onChange(path)
    }, CHANGE_DEBOUNCE_MS)
    timer.unref?.()
    timers.set(path, timer)
  }

  try {
    watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (filename === null || !filename.endsWith('.jsonl')) return
      schedule(join(root, filename))
    })
  } catch {
    return NO_WATCHER
  }

  // A watch that errors mid-flight (the root was deleted) stops being a source of truth rather
  // than crashing main; the sweep's own results stay on screen.
  watcher.on('error', () => watcher.close())

  return {
    close() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      watcher.close()
    },
  }
}
