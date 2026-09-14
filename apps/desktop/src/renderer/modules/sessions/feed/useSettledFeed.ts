import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionFeedRow } from '../types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { createHeightStore, type Reading } from './heights'
import { containerReading, settleReading } from './measure'
import { useGeometry, useSettledWidth } from './useSettledGeometry'

// One store for the launch, shared by every deck. Heights stay for every Session opened this
// launch, so switching back to a Session already read runs no pass (ADR-0033 rule 4).
const heights = createHeightStore()

export type Settled = {
  reading: Reading
  rows: readonly SessionFeedRow[]
  heights: Map<string, number>
  measuredMs: number
  settledMs: number
}

type SettledFeedOptions = {
  active: boolean
  sessionId: string | null
  revision: string | null
  rows: readonly SessionFeedRow[]
  isRunning: boolean
  stallTimeoutMs?: number
}

// Nothing is drawn until this returns a reading. A cached one returns on the same tick, which is
// the kept-deck case; anything else runs one pass behind the activity indicator.
export function useSettledFeed({
  active,
  sessionId,
  revision,
  rows,
  isRunning,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
}: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const measured = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [settled, setSettled] = useState<Settled | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const width = useSettledWidth(active, activeRef, column)
  const geometry = useGeometry(active, activeRef, measured)

  useEffect(() => {
    const container = measured.current
    if (
      !active ||
      sessionId === null ||
      revision === null ||
      container === null ||
      width === null ||
      geometry === null
    ) {
      return
    }
    const reading: Reading = {
      sessionId,
      revision,
      width: containerReading(container).width,
      ...geometry,
    }
    const cached = heights.read(reading)
    if (cached !== null) {
      // Nothing was measured and nothing was waited for, and both numbers say so.
      setSettled({ reading, rows, heights: cached, measuredMs: 0, settledMs: 0 })
      return
    }
    // A live update leaves the previously settled document in place until the new one is ready.
    // A different Session has no shared rows, so it returns to the standing state instead.
    setSettled((previous) => (previous?.reading.sessionId === sessionId ? previous : null))
    let live = true
    void settleReading(container, () => live && activeRef.current).then((pass) => {
      if (!live || pass === null) return
      heights.write(reading, pass.heights)
      setSettled({ reading, rows, ...pass })
    })
    return () => {
      live = false
    }
    // A stall here is a DOM measurement never finishing, which this pipeline has never actually
    // seen: `retryToken` is not a dependency, because retrying does not mean re-measuring, it
    // means restarting the stall bound below while the real data keeps arriving on its own poll.
  }, [active, sessionId, revision, rows, width, geometry])

  // Never hand back another Session's document. A newer revision of this Session is deliberately
  // allowed to keep the older settled document visible while its complete replacement measures.
  const settledHere = settled !== null && settled.reading.sessionId === sessionId ? settled : null

  // The Feed pane shows RunningFeed exactly while this is true (feed-content.tsx). Past the
  // bound, it shows StalledFeed instead of spinning forever (#2102).
  // A kept document keeps its own hook instance for the Session it belongs to (BasicFeed.tsx), so
  // this bound only ever watches a first load: a later revision leaves the previous settled
  // document in place (the rule above) rather than making `awaitingFeed` true again.
  const awaitingFeed = isRunning && (settledHere === null || settledHere.rows.length === 0)
  const stalled = useStallTimer(awaitingFeed ? `${sessionId}:${retryToken}` : false, stallTimeoutMs)

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  return { column, measured, settled: settledHere, stalled, retry }
}
