import type { FeedRow } from '@shared'
import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { CallRow } from './CallRow'
import { CompactionMarker } from './CompactionMarker'
import { type TextPiece, textPieces } from './linkify'
import { MediaRow } from './MediaRow'
import { MutationRow } from './MutationRow'
import { inkFor } from './minimapMatrix'
import { PlanRow } from './PlanRow'
import { Prose } from './Prose'
import { QuietRow } from './QuietRow'
import { DISCLOSURE } from './rowRecipes'

// The narrative rows of one Turn. The agent's own rows read as markdown (`Prose`, whose subset is
// decided at the parser); the prompt does not, because it is the human's typed text and never
// carried markup intent. Nothing here is dangerouslySet — model prose is untrusted input all the
// way to the screen.
const PROSE = 'whitespace-pre-wrap break-words'

/** The prompt that opened the turn, verbatim — the one row that is not the agent's voice.
 *
 * It wore a left rail to say so. Now it wears the GOLD, which is what the strip paints a prompt and
 * what the seam above it already is, so the same fact is carried by the ink every other row's is
 * carried by rather than by a border only this row had. */
function PromptRow({ text }: { text: string }): React.JSX.Element {
  return (
    <Text as="p" variant="prose" className={`${inkFor('prompt')} ${PROSE}`}>
      {/* Linkified but NOT rendered as markdown: a prompt is typed input and carried no markup
          intent, so `*` stays an asterisk — but a URL in it is still an address, and leaving it
          inert meant selecting and copying the one thing on the row you would want to click. */}
      {textPieces(text).map((piece) => (
        <LinkedPiece key={piece.at} piece={piece} />
      ))}
    </Text>
  )
}

/** One piece of a linkified plain-text row. `target="_blank"` is load-bearing here for the same
 * reason it is in `Prose`: it routes the click through main's window-open handler
 * (`shell.openExternal`, then deny) rather than navigating the cockpit away from itself. */
function LinkedPiece({ piece }: { piece: TextPiece }): React.JSX.Element {
  if (piece.href === null) return <>{piece.text}</>
  return (
    <a
      href={piece.href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary-soft underline underline-offset-2"
    >
      {piece.text}
    </a>
  )
}

/** What the agent said — the feed's primary content, and the row the eye should land on.
 *
 * FULL strength, a step above every tool row on the surface. Narration and machine work sat at the
 * same weight before, so a wall of `Run` lines read exactly as loud as the paragraph explaining
 * them; the tool rows have stepped down to `soft` and `faint` and this one has not. */
function MessageRow({ markdown }: { markdown: string }): React.JSX.Element {
  return (
    <div className={inkFor('message')}>
      <Prose markdown={markdown} />
    </div>
  )
}

// A thought's one collapsed line. Its FIRST line rather than a summary of it: a summary would be
// prose Argo wrote standing in for prose the agent wrote, which is the one thing a verbatim tier
// cannot do. The rest is a click away, never rewritten.
const firstLine = (markdown: string): string => markdown.trim().split('\n')[0] ?? ''

/**
 * The agent's reasoning, collapsed to a line and opened on demand.
 *
 * Collapsed by default because reasoning is what you consult when a conclusion surprises you, not
 * what you read first — and because a Turn's final message routinely contradicts its own thinking,
 * so reasoning presented at the same weight as the answer invites acting on an abandoned one.
 *
 * That quieting is BRIGHTNESS, not size: the agent's words read at one size across the whole feed,
 * and stepping the type down for a thought steps it mid-column against the message above it.
 */
function ThoughtRow({ markdown }: { markdown: string }): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: false })
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div className="flex flex-col gap-tight">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(DISCLOSURE, 'flex w-full items-baseline gap-snug')}
      >
        <Text aria-hidden variant="prose" className="shrink-0 text-foreground-faint">
          <Caret className="icon-sm" />
        </Text>
        <Text variant="prose" className={cn('min-w-0 flex-1 truncate', inkFor('thought'))}>
          {open ? 'thought' : firstLine(markdown)}
        </Text>
      </button>
      {open && (
        <div className="pl-mark-col text-foreground-faint">
          <Prose markdown={markdown} />
        </div>
      )}
    </div>
  )
}

/** Whether this row is a break. Only the kinds that RAN can fail — prose cannot — which is why
 * this reads a `status` rather than a flag every row would have to carry. */
const isFailed = (row: FeedRow): boolean => 'status' in row && row.status === 'failed'

/** The rows that are WORK rather than words. A run of them is a block of machine activity, and it
 * reads as one thing rather than as eleven — which is the whole reason the two are spaced apart. */
const WORK: ReadonlySet<FeedRow['kind']> = new Set(['mutation', 'call', 'quiet', 'media'])

/**
 * The space above one row — and the only reason this feed is skimmable.
 *
 * A uniform gap is what made it unskimmable: `region` between every row spent as much air between
 * two consecutive `Run` lines as between a paragraph and the work that followed it, so a hundred and
 * thirty commands pushed the narration off the screen and there was no visual difference between
 * "the agent said something" and "the agent ran another command".
 *
 * So the gap says which of the two just happened. Work following work closes to a HAIR — a run of
 * calls is a dense block you scan or skip as a unit. Everything else keeps the full step, which is
 * now the surface's signal that the VOICE changed: the eye lands on the gaps, and every gap is a
 * paragraph.
 *
 * A hair rather than nothing, and it is the smallest step there is on purpose. At zero the lines of
 * a long block set solid and the eye lost its place tracking across one — thirty commands with no
 * light between them is a paragraph of code, not a list. Two pixels is under a fifth of the step
 * that separates a block from prose, so the block still reads as one thing at a glance; it is doing
 * the job leading does inside a paragraph, not the job the gap above does between them.
 */
const gapAbove = (row: FeedRow, previous: FeedRow | undefined): string => {
  if (previous === undefined) return ''
  return WORK.has(row.kind) && WORK.has(previous.kind) ? 'pt-hair' : 'pt-region'
}

function Row({ row, root }: { row: FeedRow; root: string | null }): React.JSX.Element {
  switch (row.kind) {
    case 'prompt':
      return <PromptRow text={row.text} />
    case 'message':
      return <MessageRow markdown={row.markdown} />
    case 'thought':
      return <ThoughtRow markdown={row.markdown} />
    case 'mutation':
      return <MutationRow row={row} root={root} />
    case 'call':
      return <CallRow row={row} root={root} />
    case 'quiet':
      return <QuietRow row={row} root={root} />
    case 'media':
      return <MediaRow row={row} root={root} />
    case 'plan':
      return <PlanRow plan={row.plan} />
    case 'compaction':
      return <CompactionMarker />
  }
}

/**
 * Organism: one Turn read as prose — the prompt that opened it, what the agent thought, and what it
 * said, in the order it happened.
 *
 * The rows are decided by the derivation in `@shared`; this renders them and decides nothing. Tool
 * work joins the sequence in later tickets, which is why the row list is a union rather than three
 * lists rendered in three fixed places.
 */
export function TurnFeed({
  rows,
  root,
}: {
  rows: readonly FeedRow[]
  /** The session's working directory — what every path on these rows is shown relative to. */
  root: string | null
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <Text variant="prose" className="text-foreground-faint">
        nothing said in this turn — no prompt and no prose in the record
      </Text>
    )
  }
  return (
    // No `gap` on the container: the space is per-row and depends on what came BEFORE it, which a
    // single flex gap cannot express.
    <div data-component="TurnFeed" className="flex flex-col">
      {rows.map((row, index) => (
        // The kind travels on the element so the minimap can measure WHERE each row actually
        // landed and paint its tick at that exact fraction of the scroll — see feedScroll.ts.
        // Failure travels with it because a break is the one fact the strip must carry whatever
        // kind of row it happened to: an edit that did not land and one that did are the same
        // teal tick otherwise, which is the map's most expensive silence.
        <div
          key={row.key}
          data-feedrow={row.kind}
          data-feedfailed={isFailed(row) || undefined}
          className={gapAbove(row, rows[index - 1])}
        >
          <Row row={row} root={root} />
        </div>
      ))}
    </div>
  )
}
