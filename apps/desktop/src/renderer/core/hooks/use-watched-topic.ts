import { useEffect, useRef } from 'react'
import type { WatchTopic } from '@/core/watch/watch-contract'

// Runs when the main process says the files behind a topic changed. Any module can name its own
// topic; the roster is the first caller, and it reads itself again.
//
// This is what replaces polling: the roster used to re-read every transcript file twice a second to
// notice a Session a CLI had written outside Argo, and only while a Session was selected.
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
