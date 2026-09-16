import { MessagesSquare, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { sessionFailureState } from '../session-failure-state'
import type { SessionError } from '../types'
import { FeedLoading } from './feed-loading'
import { StalledFeed } from './stalled-feed'

export function Standing({
  failure,
  selected,
  stalled,
  posture,
  onRetry,
}: {
  failure: SessionError | null
  selected: boolean
  stalled: boolean
  posture: 'managed' | 'external' | null
  onRetry: () => void
}) {
  if (failure !== null)
    return (
      <section
        className="grid h-full place-items-center p-6"
        data-state={sessionFailureState(failure.code)}
      >
        <Alert className="max-w-sm" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Unable to load Session</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      </section>
    )
  if (!selected)
    return (
      <Empty className="h-full" data-state="unselected">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquare aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Session selected</EmptyTitle>
          <EmptyDescription>Choose a Session from the Roster to read its history.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  if (stalled) return <StalledFeed posture={posture} onRetry={onRetry} />
  return <FeedLoading state="loading" />
}
