import { ArrowSquareOutIcon, Button, Text } from '@/shared/components/ui'
import type { IntentChip, MetaSegment } from '../interiorHeader'

/**
 * Molecule: the header's one meta line — `status · model · mode · branch(+∆/↑) · elapsed` with the
 * intent link last.
 *
 * The order is fixed by the spec and comes pre-derived, so this renders segments rather than
 * deciding them: reading left to right is the triage sweep state → identity → delivery → time →
 * link. A segment Argo could not establish is simply absent from the list.
 */
export function SessionMeta({
  segments,
  intent,
  onOpenIntent,
}: {
  /** The line's segments, already in order. */
  segments: readonly MetaSegment[]
  /** The navigable ticket link, or `null` where there is nothing to jump to. */
  intent: IntentChip | null
  /** Open the linked Work Item. Absent leaves the chip inert (the read-only stories). */
  onOpenIntent?: (number: number) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-snug">
      {segments.map((segment, index) => (
        <div key={segment.id} className="flex min-w-0 items-center gap-snug">
          {index > 0 && (
            <Text aria-hidden variant="meta" className="text-foreground-faint">
              ·
            </Text>
          )}
          <Text
            variant={segment.mono ? 'code-inline' : 'meta'}
            className="min-w-0 truncate text-foreground-soft"
          >
            {segment.text}
          </Text>
        </div>
      ))}
      {intent && (
        <>
          <Text aria-hidden variant="meta" className="text-foreground-faint">
            ·
          </Text>
          <Button
            variant="quiet"
            size="sm"
            className="gap-tight"
            onClick={() => onOpenIntent?.(intent.number)}
          >
            <Text variant="meta" className="text-primary">
              {intent.text}
            </Text>
            <ArrowSquareOutIcon aria-hidden className="icon-sm text-primary" />
          </Button>
        </>
      )}
    </div>
  )
}
