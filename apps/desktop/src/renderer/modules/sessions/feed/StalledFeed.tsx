import { RotateCw } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

// Past a stall bound (feed-stall.ts), the reader sees this instead of an indefinite spinner.
// Retry re-runs whatever produced the stall rather than reloading the app (#2102).
export function StalledFeed({
  posture,
  onRetry,
}: {
  posture: 'managed' | 'external' | null
  onRetry: () => void
}) {
  return (
    <Empty className="h-full border-0" data-state="stalled">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RotateCw aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Could not load this Session</EmptyTitle>
        <EmptyDescription>
          {posture === 'external'
            ? 'This Session is external. Argo reads its history from a file it does not control, and the read is taking too long.'
            : 'Argo tried to load the history for this Session, but the load did not finish.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  )
}
