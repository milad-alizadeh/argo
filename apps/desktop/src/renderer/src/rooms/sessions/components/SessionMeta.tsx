import {
  ArrowLineUpIcon,
  ArrowSquareOutIcon,
  Button,
  PencilSimpleIcon,
  StatusDot,
  Text,
} from '@/shared/components/ui'
import type { ActivityDot } from '../activityStates'
import type { IntentChip, MetaSegment } from '../interiorHeader'

/** One count of what has changed against the branch — an ICON and a number, never a typed-in mark.
 * Nested in a `Text` so the em-relative icon box tracks the line it sits on. */
function Delta({
  Glyph,
  count,
  label,
  tone,
}: {
  Glyph: typeof PencilSimpleIcon
  count: number
  label: string
  tone: string
}): React.JSX.Element {
  return (
    <Text variant="meta" className={`flex items-center gap-tight ${tone}`}>
      <Glyph aria-label={label} className="icon-sm" />
      {count}
    </Text>
  )
}

/** One segment's own words. The branch keeps its NAME and wears its counts beside it. A zero renders
 * nothing, so a clean branch shows no counts rather than two zeroes reading as state. */
function Segment({ segment }: { segment: MetaSegment }): React.JSX.Element {
  switch (segment.id) {
    case 'branch':
      return (
        <>
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-soft">
            {segment.text}
          </Text>
          {segment.dirty > 0 && (
            <Delta
              Glyph={PencilSimpleIcon}
              count={segment.dirty}
              label="uncommitted files"
              tone="text-tone-amber"
            />
          )}
          {segment.unpushed > 0 && (
            <Delta
              Glyph={ArrowLineUpIcon}
              count={segment.unpushed}
              label="unpushed commits"
              tone="text-tone-run"
            />
          )}
        </>
      )
    case 'mode':
    case 'elapsed':
    case 'tokens':
      return (
        <Text variant="meta" className="min-w-0 truncate text-foreground-soft">
          {segment.text}
        </Text>
      )
  }
}

/**
 * Molecule: the header's one meta line — a status dot, then `mode · branch(+counts) · elapsed` with
 * the intent link last.
 *
 * The state leads as a DOT and never also as a word: the roster rail beside this plane already
 * spells the word, and the model it also names is shed here for the same reason. What is left is
 * what the rail does not carry. The order comes pre-derived, so this renders segments rather than
 * deciding them, and a segment Argo could not establish is simply absent from the list.
 */
export function SessionMeta({
  status,
  segments,
  intent,
  onOpenIntent,
}: {
  /** The session's state, as the dot the line leads with. */
  status: ActivityDot
  /** The line's segments, already in order. */
  segments: readonly MetaSegment[]
  /** The navigable ticket link, or `null` where there is nothing to jump to. */
  intent: IntentChip | null
  /** Open the linked Work Item. Absent leaves the chip inert (the read-only stories). */
  onOpenIntent?: (number: number) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-snug">
      <StatusDot tone={status.tone} glow={status.glow} pulse={status.pulse} />
      {segments.map((segment, index) => (
        <div key={segment.id} className="flex min-w-0 items-center gap-snug">
          {index > 0 && (
            <Text aria-hidden variant="meta" className="text-foreground-faint">
              ·
            </Text>
          )}
          <Segment segment={segment} />
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
