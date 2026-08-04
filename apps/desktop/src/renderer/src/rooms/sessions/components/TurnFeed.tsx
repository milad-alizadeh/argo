import type { FeedRow } from '@shared'
import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { MutationRow } from './MutationRow'
import { Prose } from './Prose'
import { DISCLOSURE } from './rowRecipes'

// The narrative rows of one Turn. The agent's own rows read as markdown (`Prose`, whose subset is
// decided at the parser); the prompt does not, because it is the human's typed text and never
// carried markup intent. Nothing here is dangerouslySet — model prose is untrusted input all the
// way to the screen.
const PROSE = 'whitespace-pre-wrap break-words'

/** The prompt that opened the turn, verbatim. It hangs off a rail because it is the one row that is
 * not the agent's voice: the cause, quoted, with the work that followed on the axis below it. */
function PromptRow({ text }: { text: string }): React.JSX.Element {
  return (
    <Text
      as="p"
      variant="prose"
      className={`border-l border-l-inset-hair pl-inset text-foreground ${PROSE}`}
    >
      {text}
    </Text>
  )
}

/** What the agent said — the feed's primary content, and the row the eye should land on. Body tone
 * rather than full strength: it is the longest row on the surface, and prose read at the weight of a
 * heading is prose nobody finishes. */
function MessageRow({ markdown }: { markdown: string }): React.JSX.Element {
  return (
    <div className="text-foreground-soft">
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
        <Text variant="prose" className="min-w-0 flex-1 truncate text-foreground-faint">
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

function Row({ row }: { row: FeedRow }): React.JSX.Element {
  switch (row.kind) {
    case 'prompt':
      return <PromptRow text={row.text} />
    case 'message':
      return <MessageRow markdown={row.markdown} />
    case 'thought':
      return <ThoughtRow markdown={row.markdown} />
    case 'mutation':
      return <MutationRow row={row} />
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
export function TurnFeed({ rows }: { rows: readonly FeedRow[] }): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <Text variant="prose" className="text-foreground-faint">
        nothing said in this turn — no prompt and no prose in the record
      </Text>
    )
  }
  return (
    <div data-component="TurnFeed" className="flex flex-col gap-region">
      {rows.map((row) => (
        <Row key={row.key} row={row} />
      ))}
    </div>
  )
}
