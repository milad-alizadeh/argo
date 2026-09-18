import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { AnchoredFeed } from './anchored-feed'
import type { DrawnRowProps } from './drawn-row'
import { FeedLoading } from './feed-loading'
import type { Reveal } from './reveal'
import { StalledFeed } from './stalled-feed'
import { awaitingAssistantReply, type Settled, type useSettledFeed } from './use-settled-feed'

export function feedContent({
  active,
  settled,
  isRunning,
  stalled,
  posture,
  onRetry,
  onJumpToLatestChange,
  DrawnRow,
  revealsFor,
  streamingRowId,
  tail,
}: {
  active: boolean
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  stalled: boolean
  posture: 'managed' | 'external' | null
  onRetry: () => void
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  DrawnRow: (props: DrawnRowProps) => ReactNode
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  tail: ReactNode
}) {
  if (
    isRunning &&
    (settled === null || settled.rows.length === 0 || awaitingAssistantReply(settled.rows))
  ) {
    return stalled ? (
      <StalledFeed onRetry={onRetry} posture={posture} />
    ) : (
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
            <Inbox aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No messages</EmptyTitle>
          <EmptyDescription>This Session has no messages to show.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <AnchoredFeed
      active={active}
      rows={settled.rows}
      settled={settled}
      FeedRow={DrawnRow}
      onJumpToLatestChange={onJumpToLatestChange}
      revealsFor={revealsFor}
      streamingRowId={streamingRowId}
      tail={tail}
    />
  )
}
