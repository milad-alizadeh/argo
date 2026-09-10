import { CircleAlertIcon } from 'lucide-react'

import { Marker, MarkerContent, MarkerIcon } from '../../../components/ui/marker'
import { Spinner } from '../../../components/ui/spinner'

// The Feed's first row while it has nothing settled to draw: shadcn's status Marker, set in the
// same box a Feed row is set in, so its line sits exactly where the first line of the history
// will. `busy` is the measure pass or the read before it; otherwise it is the reason the Feed is
// not drawn, a read that failed.
//
// The spinner turns on its wrapper and not on itself (ADR-0033 · The activity indicator): the
// animation has to keep running through the blocked main thread of the pass, so it is a transform
// on an HTML box the compositor owns, and never an animated SVG. The label shimmers the way the
// docs' "Thinking" marker does; that one is a paint, so it may pause through the pass while the
// spinner beside it keeps turning.
export function SessionActivityIndicator({ label, busy }: { label: string; busy: boolean }) {
  return (
    <div className="feed__content feed__standing">
      <div className="feed-row">
        <Marker aria-live="polite" className={busy ? undefined : 'text-destructive'} role="status">
          {busy ? (
            <MarkerIcon className="animate-spin">
              <Spinner
                aria-hidden="true"
                aria-label={undefined}
                className="animate-none"
                role="presentation"
              />
            </MarkerIcon>
          ) : (
            <MarkerIcon>
              <CircleAlertIcon />
            </MarkerIcon>
          )}
          <MarkerContent className={busy ? 'shimmer' : undefined}>{label}</MarkerContent>
        </Marker>
      </div>
    </div>
  )
}
