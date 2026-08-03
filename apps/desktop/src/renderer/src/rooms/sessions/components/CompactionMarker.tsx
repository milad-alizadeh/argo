import { Text } from '@/shared/components/ui'

/**
 * Molecule: the seam where history was condensed.
 *
 * It renders **inside** the turn sequence with a rule stitched across it, so a compacted history
 * reads as continuous rather than as a gap — the resume chain did not lose the session, and the
 * marker should not suggest otherwise.
 */
export function CompactionMarker(): React.JSX.Element {
  return (
    <div data-component="CompactionMarker" className="flex items-center gap-gap py-tight">
      <span aria-hidden className="h-px flex-1 bg-border" />
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        compacted
      </Text>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}
