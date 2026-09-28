import type { VirtualItem } from '@tanstack/virtual-core'
import type { ReactNode } from 'react'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { FeedLoading } from '../feed-loading'
import { AnchoredFeed } from '../scroll/anchored-feed'
import type { Reveal } from '../scroll/reveal'
import type { DrawnRowProps } from './drawn-row'
import { awaitingAssistantReply, type useSettledFeed } from './use-settled-feed'

export function feedContent({
  initialMeasurementsCache,
  initialScrollPosition,
  settled,
  isRunning,
  stalled,
  onJumpToLatestChange,
  onMeasurementsChange,
  onScrollPositionChange,
  DrawnRow,
  reveals,
  streamingRowId,
  tail,
  emptyText,
  historyLabel,
}: {
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  stalled: boolean
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  DrawnRow: (props: DrawnRowProps) => ReactNode
  reveals: ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  tail: ReactNode
  emptyText: readonly [title: string, description: string]
  historyLabel: string
}) {
  const noRows = settled === null || settled.rows.length === 0
  const awaitingReply = isRunning && (noRows || awaitingAssistantReply(settled.rows))
  if (noRows && awaitingReply) {
    return (
      <>
        {stalled ? null : <FeedLoading state="running" />}
        {tail}
      </>
    )
  }
  if (settled === null) return tail
  if (settled.rows.length === 0)
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="empty-feed" />
          </EmptyMedia>
          <EmptyTitle>{emptyText[0]}</EmptyTitle>
          <EmptyDescription>{emptyText[1]}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <>
      <AnchoredFeed
        active
        initialMeasurementsCache={initialMeasurementsCache}
        initialScrollPosition={initialScrollPosition}
        rows={settled.rows}
        settled={settled}
        FeedRow={DrawnRow}
        onJumpToLatestChange={onJumpToLatestChange}
        onMeasurementsChange={onMeasurementsChange}
        onScrollPositionChange={onScrollPositionChange}
        reveals={reveals}
        streamingRowId={streamingRowId}
        tail={tail}
        historyLabel={historyLabel}
      />
      {awaitingReply && !stalled && tail === null ? <FeedLoading state="running" /> : null}
    </>
  )
}
