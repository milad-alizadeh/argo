import type { VirtualItem } from '@tanstack/virtual-core'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../document/use-settled-feed'
import { FeedLoading } from '../feed-loading'
import {
  feedScrollPaddingStart,
  useAnchoredVirtualizer,
  useFeedViewport,
  useInitialFeedPosition,
  useScrollPositionSnapshot,
  useTailThroughViewportResize,
} from './anchoring'
import { type FeedRowComponent, FeedViewport } from './feed-viewport'
import { useFeedPrompt, usePromptHold } from './prompt-pin'
import type { Reveal } from './reveal'
import { useFeedTailFollow, useJumpToLatest } from './tail-follow'

type AnchoredFeedProps = {
  active: boolean
  FeedRow: FeedRowComponent
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  reveals: ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  historyLabel: string
  loadOlder?: (() => void) | undefined
}

function MeasureFeedRows({
  FeedRow,
  onMeasured,
  rows,
}: Pick<AnchoredFeedProps, 'FeedRow' | 'rows'> & {
  onMeasured: (measurements: VirtualItem[]) => void
}) {
  const content = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    let active = true
    const measure = async () => {
      await document.fonts.ready
      if (!active || content.current === null) return
      const wrappers = Array.from(content.current.children) as HTMLElement[]
      const paddingStart = feedScrollPaddingStart(content.current.parentElement as HTMLElement)
      let start = paddingStart
      const measurements = wrappers.map((wrapper, index): VirtualItem => {
        const size = wrapper.getBoundingClientRect().height
        const item = {
          index,
          key: rows[index]?.id ?? '',
          start,
          size,
          end: start + size,
          lane: 0,
        }
        start = item.end
        return item
      })
      onMeasured(measurements)
    }
    void measure()
    return () => {
      active = false
    }
  }, [onMeasured, rows])
  return (
    <>
      <FeedLoading state="loading" />
      <div aria-hidden="true" className="feed__measurement" inert>
        <div className="feed__content" ref={content}>
          {rows.map((row, index) => (
            <div data-index={index} key={row.id}>
              <FeedRow measurement row={row} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// Every existing row gets its Blink height at the Feed's real width before the virtual list opens.
export function AnchoredFeed(props: AnchoredFeedProps) {
  const [measurements, setMeasurements] = useState<VirtualItem[] | null>(null)
  const onMeasured = useCallback((next: VirtualItem[]) => setMeasurements(next), [])
  if (measurements === null)
    return <MeasureFeedRows FeedRow={props.FeedRow} onMeasured={onMeasured} rows={props.rows} />
  return <VirtualFeed {...props} initialMeasurementsCache={measurements} />
}

// Within a screen of the first row, the page before it is asked for once; the rows it adds come in
// above the visible ones, which the prepend anchor holds still.
function useOlderPageNearStart({
  firstRowId,
  loadOlder,
  positioned,
  viewport,
}: {
  firstRowId: string | undefined
  loadOlder: (() => void) | undefined
  positioned: boolean
  viewport: HTMLElement | null
}) {
  useLayoutEffect(() => {
    if (viewport === null || loadOlder === undefined || !positioned || firstRowId === undefined)
      return
    let asked = false
    const ask = () => {
      if (asked || viewport.scrollTop > viewport.clientHeight) return
      asked = true
      loadOlder()
    }
    ask()
    viewport.addEventListener('scroll', ask, { passive: true })
    return () => viewport.removeEventListener('scroll', ask)
  }, [firstRowId, loadOlder, positioned, viewport])
}

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
function VirtualFeed({
  active,
  FeedRow,
  initialMeasurementsCache,
  initialScrollPosition,
  onJumpToLatestChange,
  onMeasurementsChange,
  onScrollPositionChange,
  rows,
  settled,
  reveals,
  streamingRowId,
  historyLabel,
  loadOlder,
}: AnchoredFeedProps) {
  const { attachViewport, paddingStart, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId, { active, viewport })
  const { following, update: updatePromptHold } = usePromptHold(tailFollow.shouldFollow)
  const virtualizer = useAnchoredVirtualizer({
    following,
    initialMeasurementsCache,
    initialScrollPosition,
    positioned: !tailFollow.awaitingInitialPosition,
    rows,
    viewport,
    paddingStart,
    onChange: tailFollow.onChange,
  })
  useTailThroughViewportResize(viewport, following)
  useOlderPageNearStart({
    firstRowId: rows[0]?.id,
    loadOlder,
    positioned: !tailFollow.awaitingInitialPosition,
    viewport,
  })
  useInitialFeedPosition({
    initialScrollPosition,
    onPositioned: tailFollow.markInitiallyPositioned,
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  useScrollPositionSnapshot(
    settled.reading.sessionId,
    viewport,
    virtualizer,
    onScrollPositionChange,
    onMeasurementsChange,
  )
  const promptIndex = useFeedPrompt({
    positioned: !tailFollow.awaitingInitialPosition,
    rows,
    sessionId: settled.reading.sessionId,
    virtualizer,
    updatePromptHold,
    paddingStart,
  })
  useJumpToLatest({
    active,
    onJumpToLatestChange,
    sessionId: settled.reading.sessionId,
    tailFollow,
    virtualizer,
    viewport,
  })

  return (
    <div className="feed__scroller">
      <FeedViewport
        FeedRow={FeedRow}
        gap={paddingStart}
        promptIndex={promptIndex}
        reveals={reveals}
        rows={rows}
        setViewport={attachViewport}
        settled={settled}
        streamingRowId={streamingRowId}
        historyLabel={historyLabel}
        virtualizer={virtualizer}
      />
    </div>
  )
}
