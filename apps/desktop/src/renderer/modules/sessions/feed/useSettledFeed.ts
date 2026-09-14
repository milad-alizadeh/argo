import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import type { SessionFeedRow } from '../types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { createHeightStore, type Reading } from './heights'
import { containerReading } from './measure'
import { runSettlePass } from './relayout'
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
  // The Session's own revision, apart from any layout-only state folded into `revision` (a
  // collapsible's open set, today). Unchanged from the last settle, it says no row's content
  // actually moved, so the pass can read heights on the same frame the toggle commits instead of
  // behind the warm-up rule 3 built for new content.
  contentRevision: string | null
  rows: readonly SessionFeedRow[]
  isRunning: boolean
  stallTimeoutMs?: number
}

// Nothing is drawn until this returns a reading. A cached one returns on the same tick, which is
// the kept-deck case; anything else runs one pass behind the activity indicator, unless the
// reading's content hasn't moved, in which case there is nothing to await either.
export function useSettledFeed({
  active,
  sessionId,
  revision,
  contentRevision,
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
  // The (Session, content) pair the last settled reading was drawn against, read and written in
  // the same layout effect the pass runs in. A relayout that leaves it unchanged — a collapsible's
  // own open set, or a column resize settling — moved no row's content, so it is read on the spot
  // instead of behind rule 3's warm-up.
  const settledContent = useRef<{ sessionId: string; contentRevision: string } | null>(null)
  const relayoutGeneration = useRef(0)

  // A layout effect, not a passive one: a relayout is read back before the browser paints the
  // commit that triggered it, so a toggled disclosure never paints the frame in between, its panel
  // already at its open size while the row around it still carries the old, smaller height.
  useLayoutEffect(() => {
    const container = measured.current
    if (
      !active ||
      sessionId === null ||
      revision === null ||
      contentRevision === null ||
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
    return runSettlePass({
      container,
      reading,
      rows,
      heights,
      sessionId,
      contentRevision,
      settledContent,
      generation: relayoutGeneration,
      isActive: () => activeRef.current,
      setSettled,
    })
    // A stall here is a DOM measurement never finishing, which this pipeline has never actually
    // seen: `retryToken` is not a dependency, because retrying does not mean re-measuring, it
    // means restarting the stall bound below while the real data keeps arriving on its own poll.
  }, [active, sessionId, revision, contentRevision, rows, width, geometry])

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
