import {
  AccentCard,
  AccentCardHeader,
  type AccentCardTone,
  Button,
  CaretRightIcon,
  GitMergeIcon,
  type IconAtom,
  ProhibitIcon,
  Text,
} from '@/shared/components/ui'
import type { ClosedSummary, MergedSummary } from '../nodeDrawerModel'

/**
 * The terminal card — the epilogue that replaces the whole lifecycle strip once a session has
 * landed or been closed (R8). An `AccentCard` milestone block: the rail + eyebrow carry the
 * terminal identity (`tone-landed` for a merge, muted for a close), a one-line summary states
 * the outcome, and the single forward step is a quiet secondary control — every terminal
 * control is secondary, the session's work is already done.
 */
function TerminalCard({
  tone,
  glyphTone,
  eyebrow,
  Glyph,
  when,
  headline,
  meta,
  action,
}: {
  /** The card's rail/wash tone. */
  tone: AccentCardTone
  /** The glyph + eyebrow colour, e.g. `text-tone-landed`. */
  glyphTone: string
  /** The terminal wordmark — `Landed` / `Closed`. */
  eyebrow: string
  /** The state's glyph — merge or prohibit. */
  Glyph: IconAtom
  /** When the session reached this state. */
  when: string
  /** The outcome line — merge target + sha, or the closed reason. */
  headline: React.ReactNode
  /** The quiet attribution line under the outcome. */
  meta: React.ReactNode
  /** The forward step's label. */
  action: string
}): React.JSX.Element {
  return (
    <AccentCard tone={tone}>
      <AccentCardHeader
        icon={<Glyph aria-hidden className={glyphTone} />}
        eyebrow={eyebrow}
        eyebrowClassName={glyphTone}
        trailing={
          <Text variant="meta" className="text-foreground-faint">
            {when}
          </Text>
        }
      />
      <Text variant="row-strong" className="text-foreground-soft">
        {headline}
      </Text>
      <div className="flex items-center gap-gap">
        <Text variant="meta" className="text-foreground-faint">
          {meta}
        </Text>
        <span className="grow" />
        <Button variant="ghost" size="sm">
          {action}
          <CaretRightIcon aria-hidden />
        </Button>
      </div>
    </AccentCard>
  )
}

export function mergedBody(summary: MergedSummary): React.JSX.Element {
  return (
    <TerminalCard
      tone="landed"
      glyphTone="text-tone-landed"
      eyebrow="Landed"
      Glyph={GitMergeIcon}
      when={summary.when}
      headline={
        <>
          Merged into <Text variant="code-inline">main</Text> ·{' '}
          <Text variant="code-inline" className="text-foreground-soft">
            {summary.sha}
          </Text>
        </>
      }
      meta={`by ${summary.by} · ${summary.how}`}
      action="Next ticket from main"
    />
  )
}

export function closedBody(summary: ClosedSummary): React.JSX.Element {
  return (
    <TerminalCard
      tone="neutral"
      glyphTone="text-foreground-faint"
      eyebrow="Closed"
      Glyph={ProhibitIcon}
      when={summary.when}
      headline="Closed without merge"
      meta={`by ${summary.by} · ${summary.note}`}
      action="New session from main"
    />
  )
}
