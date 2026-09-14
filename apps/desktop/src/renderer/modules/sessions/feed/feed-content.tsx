import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import { AnchoredFeed } from './AnchoredFeed'
import type { DrawnRowProps } from './drawn-row'
import type { Reveal } from './reveal'
import type { Settled, useSettledFeed } from './useSettledFeed'

function RunningFeed() {
  return (
    <section className="grid h-full place-items-center" data-state="running">
      <Spinner className="size-6" />
    </section>
  )
}

export function feedContent({
  settled,
  isRunning,
  DrawnRow,
  revealsFor,
}: {
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  DrawnRow: (props: DrawnRowProps) => ReactNode
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
}) {
  if (settled === null) return isRunning ? <RunningFeed /> : null
  if (settled.rows.length === 0 && isRunning) return <RunningFeed />
  if (settled.rows.length === 0)
    return (
      <Empty className="h-full border-0">
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
      rows={settled.rows}
      settled={settled}
      FeedRow={DrawnRow}
      revealsFor={revealsFor}
    />
  )
}
