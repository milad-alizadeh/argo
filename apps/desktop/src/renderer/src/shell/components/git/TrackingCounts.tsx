import { Text } from '@/shared/components/ui'

/**
 * Atom: how far a branch has drifted from its upstream, as `↑ahead ↓behind`.
 *
 * A zero renders nothing, so a branch in step shows neither count: two zeroes beside a name
 * would read as state where there is none. The two are separately toned because they are
 * separate facts — one is yours to push, the other is origin's to pull — and the arrows are
 * typographic content in the notation the spec itself writes (`⎇ main ↑2↓1`), not icons.
 */
export function TrackingCounts({
  ahead,
  behind,
}: {
  /** Commits this branch holds that its upstream does not. */
  ahead: number
  /** Commits the upstream holds that this branch does not. */
  behind: number
}): React.JSX.Element {
  return (
    <>
      {ahead > 0 && <Text variant="meta" className="text-tone-run">{`↑${ahead}`}</Text>}
      {behind > 0 && <Text variant="meta" className="text-tone-amber">{`↓${behind}`}</Text>}
    </>
  )
}
