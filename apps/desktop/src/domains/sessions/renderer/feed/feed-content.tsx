import type { ReactNode } from 'react'
import { AnchoredFeed } from '@/domains/sessions/renderer/feed/anchored-feed'
import type { DrawnRowProps } from '@/domains/sessions/renderer/feed/drawn-row'
import { FeedLoading } from '@/domains/sessions/renderer/feed/feed-loading'
import type { Reveal } from '@/domains/sessions/renderer/feed/reveal'
import { StalledFeed } from '@/domains/sessions/renderer/feed/stalled-feed'
import {
  awaitingAssistantReply,
  type Settled,
  type useSettledFeed,
} from '@/domains/sessions/renderer/feed/use-settled-feed'
import { Icon } from '@/platform/renderer/components/icon'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

export function feedContent({
  active,
  initialScrollPosition,
  settled,
  isRunning,
  stalled,
  posture,
  onRetry,
  onJumpToLatestChange,
  onScrollPositionChange,
  DrawnRow,
  revealsFor,
  streamingRowId,
  tail,
  emptyText,
}: {
  active: boolean
  initialScrollPosition: number | null
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  stalled: boolean
  posture: 'managed' | 'external' | null
  onRetry: () => void
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  DrawnRow: (props: DrawnRowProps) => ReactNode
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  tail: ReactNode
  emptyText: readonly [title: string, description: string]
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
      initialScrollPosition={initialScrollPosition}
      rows={settled.rows}
      settled={settled}
      FeedRow={DrawnRow}
      onJumpToLatestChange={onJumpToLatestChange}
      onScrollPositionChange={onScrollPositionChange}
      revealsFor={revealsFor}
      streamingRowId={streamingRowId}
      tail={tail}
    />
  )
}
