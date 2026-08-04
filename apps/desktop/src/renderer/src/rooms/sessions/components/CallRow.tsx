import type { CallRow as CallRowModel, ToolCallStatus } from '@shared'
import { cn } from '@/lib/utils'
import { type IconAtom, TerminalWindowIcon, Text, WarningIcon } from '@/shared/components/ui'
import { CallOutput } from './CallOutput'

// The row a single call earns: a command, always, and a failure of any other kind. Between them and
// the mutation row, everything loud on this surface is a row you cannot fold away.

interface CallMark {
  Icon: IconAtom
  /** The word the row wears, in the vocabulary of what happened to the CALL. */
  word: string
  tone: string
  /** A ring around the whole card, for the one state worth ringing. */
  ring: string
}

const RAN: CallMark = {
  Icon: TerminalWindowIcon,
  word: 'ran',
  tone: 'text-foreground-soft',
  ring: '',
}

const RUNNING: CallMark = {
  Icon: TerminalWindowIcon,
  word: 'running',
  tone: 'text-tone-run',
  ring: '',
}

/** A failure wears its own mark whatever the call was for: a failed read is a failure first, and the
 * ring is what stops it reading as one more line of chatter. */
const FAILED: CallMark = {
  Icon: WarningIcon,
  word: 'failed',
  tone: 'text-tone-red',
  ring: 'ring-1 ring-inset ring-tone-red/25',
}

function callMark(status: ToolCallStatus): CallMark {
  switch (status) {
    case 'pending':
    case 'in_progress':
      return RUNNING
    case 'failed':
      return FAILED
    case 'completed':
      return RAN
  }
}

/** What the row names. A command shows its command LINE alone — the tool's name (`Bash`) adds nothing
 * a reader wants and the line is the whole fact. Every other kind shows the host's own tool name
 * beside its target, because `Read` is what says what `src/x.ts` was being done to. */
function subject(row: CallRowModel): string {
  if (row.callKind === 'execute') return row.target ?? 'a command the record did not name'
  return row.target === null ? row.name : `${row.name} · ${row.target}`
}

/**
 * Organism: one call loud enough to stand alone — a command, or a failure.
 *
 * A command's line is always on screen and its output is one click away, so a run of commands can be
 * scanned without wading through build logs. A FAILURE opens its output already, because the thing
 * that went wrong should be the thing you see. Which of the two it is was decided by the derivation
 * and arrives on the row; this component reads it rather than re-deciding it.
 */
export function CallRow({ row }: { row: CallRowModel }): React.JSX.Element {
  const { Icon, word, tone, ring } = callMark(row.status)
  return (
    <div className={cn('flex flex-col gap-tight rounded-md inset-card px-inset py-gap', ring)}>
      <div className="flex items-baseline gap-snug">
        {/* The mark column: every row of this feed hangs its glyph in one fixed cell, so a wall of
            them reads as a column rather than as lines that each start a pixel or two off. */}
        <Text
          aria-hidden
          variant="code"
          className={cn('grid w-mark-col shrink-0 place-items-center', tone)}
        >
          <Icon className="icon-sm" />
        </Text>
        <Text variant="code" className={cn('shrink-0 uppercase', tone)}>
          {word}
        </Text>
        <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-soft">
          {subject(row)}
        </Text>
      </div>
      {row.output === null ? (
        <Text variant="code" className="text-foreground-faint">
          {row.status === 'completed' || row.status === 'failed'
            ? 'no output: this call printed nothing'
            : 'no output yet: this call has not come back'}
        </Text>
      ) : (
        <CallOutput output={row.output} defaultOpen={row.open} />
      )}
    </div>
  )
}
