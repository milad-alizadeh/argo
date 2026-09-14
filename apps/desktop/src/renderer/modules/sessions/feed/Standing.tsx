import { MessagesSquare, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError } from '../types'
import { StalledFeed } from './StalledFeed'

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
      <Empty className="h-full border-0" data-state="unselected">
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
  return (
    <section className="grid h-full place-items-center" data-state="loading">
      <Spinner className="size-6" />
    </section>
  )
}
