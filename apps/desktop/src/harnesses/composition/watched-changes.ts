import type { WatchedSource } from '@/platform/main/watch/watch-source'

function watchedChanges(changed: Set<() => void>): WatchedSource {
  return (listener) => {
    changed.add(listener)
    return () => changed.delete(listener)
  }
}

function notifyWatchedChanges(changed: Set<() => void>) {
  for (const listener of changed) listener()
}

export function createWatchedChanges() {
  const changed = new Set<() => void>()
  return {
    notify: () => notifyWatchedChanges(changed),
    subscribe: watchedChanges(changed),
  }
}
