import { isWatchTopic, type WatchTopic } from '../shared/watch'

export type WatchClient = {
  onWatchedChanged(listener: (topic: WatchTopic) => void): () => void
}

export function createWatchClient(
  subscribe: (listener: (topic: unknown) => void) => () => void,
): WatchClient {
  const listeners = new Map<number, (topic: WatchTopic) => void>()
  let disposeSubscription: (() => void) | null = null
  let nextListenerId = 0

  const forward = (topic: unknown) => {
    if (!isWatchTopic(topic)) return
    for (const listener of [...listeners.values()]) listener(topic)
  }

  return {
    onWatchedChanged(listener) {
      const listenerId = nextListenerId
      nextListenerId += 1
      listeners.set(listenerId, listener)
      disposeSubscription ??= subscribe(forward)
      return () => {
        listeners.delete(listenerId)
        if (listeners.size !== 0) return
        disposeSubscription?.()
        disposeSubscription = null
      }
    },
  }
}
