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
import { awaitingAssistantReply, type Settled, type useSettledFeed } from './use-settled-feed'

export function feedContent({
  hasOlder,
  loadingOlder,
  olderError,
  onLoadOlder,
  initialMeasurementsCache,
  initialScrollPosition,
  settled,
  isRunning,
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
  hasOlder?: boolean
  loadingOlder?: boolean
  olderError?: boolean
  onLoadOlder?: () => void
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
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
  if (noRows && awaitingReply) {
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
    <>
      <AnchoredFeed
        active
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        olderError={olderError}
        onLoadOlder={onLoadOlder}
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
      {awaitingReply && tail === null ? <FeedLoading state="running" /> : null}
    </>
  )
}
