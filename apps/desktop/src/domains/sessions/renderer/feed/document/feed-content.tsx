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
import { StalledFeed } from '../stalled-feed'
import type { DrawnRowProps } from './drawn-row'
import { awaitingAssistantReply, type Settled, type useSettledFeed } from './use-settled-feed'

export function feedContent({
  active,
  initialMeasurementsCache,
  initialScrollPosition,
  settled,
  isRunning,
  stalled,
  posture,
  onRetry,
  onJumpToLatestChange,
  onMeasurementsChange,
  onScrollPositionChange,
  DrawnRow,
  revealsFor,
  streamingRowId,
  tail,
  emptyText,
  historyLabel,
}: {
  active: boolean
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  stalled: boolean
  posture: 'managed' | 'external' | 'watched' | null
  onRetry: () => void
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  DrawnRow: (props: DrawnRowProps) => ReactNode
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  tail: ReactNode
  emptyText: readonly [title: string, description: string]
  historyLabel: string
}) {
  const noRows = settled === null || settled.rows.length === 0
  const awaitingReply = isRunning && (noRows || awaitingAssistantReply(settled.rows))
  if (awaitingReply && stalled) return <StalledFeed onRetry={onRetry} posture={posture} />
  // A prompt still waiting on its reply stays on screen while the Marker draws below it (#2430).
  if (isRunning && (noRows || tail === null) && awaitingReply) {
    return (
      <>
        <FeedLoading state="running" />
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
    <AnchoredFeed
      active={active}
      initialMeasurementsCache={initialMeasurementsCache}
      initialScrollPosition={initialScrollPosition}
      rows={settled.rows}
      settled={settled}
      FeedRow={DrawnRow}
      onJumpToLatestChange={onJumpToLatestChange}
      onMeasurementsChange={onMeasurementsChange}
      onScrollPositionChange={onScrollPositionChange}
      revealsFor={revealsFor}
      streamingRowId={streamingRowId}
      tail={tail}
      historyLabel={historyLabel}
    />
  )
}
