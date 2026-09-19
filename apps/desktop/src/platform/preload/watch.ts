import { isWatchTopic, type WatchTopic } from '@/platform/shared/watch'

export type WatchClient = {
  onWatchedChanged(listener: (topic: WatchTopic) => void): () => void
}

export function createWatchClient(
  subscribe: (listener: (topic: unknown) => void) => () => void,
): WatchClient {
  return {
    onWatchedChanged(listener) {
      return subscribe((topic) => {
        if (isWatchTopic(topic)) listener(topic)
      })
    },
  }
}
