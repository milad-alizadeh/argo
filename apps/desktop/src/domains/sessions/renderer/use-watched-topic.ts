import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { WatchTopic } from '@/platform/shared/watch'

// Runs when the main process says the files behind a topic changed. Any module can name its own
// topic; the roster and the Feed are the first callers, and each reads itself again.
//
// This is what replaces polling: the roster used to re-read every transcript file twice a second to
// notice a Session a Harness had written outside Argo, and only while a Session was selected.
export function useWatchedTopic(topic: WatchTopic, onChanged: () => void) {
  // The latest callback is read through a ref, so a caller passing an inline closure does not
  // resubscribe on every render.
  const latest = useRef(onChanged)
  latest.current = onChanged
  useEffect(
    () =>
      window.argo.onWatchedChanged((changed) => {
        if (changed === topic) latest.current()
      }),
    [topic],
  )
}

// The shape most readers want: name the topic, name the reads its files make stale, and stop polling
// for them. A disabled or unmounted query ignores its own invalidation, so a caller may list a key it
// is not currently reading.
export function useWatchedQueries(topic: WatchTopic, keys: readonly QueryKey[]) {
  const queryClient = useQueryClient()
  useWatchedTopic(topic, () => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
  })
}
