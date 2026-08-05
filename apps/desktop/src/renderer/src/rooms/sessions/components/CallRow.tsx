import type { CallRowModel, ToolCallStatus } from '@shared'
import { TerminalWindowIcon, Text, WarningIcon } from '@/shared/components/ui'
import { CallOutput } from './CallOutput'
import { FAILED_RING, LoudRow, type RowMark } from './LoudRow'

// The row a single call earns: a command, always, and a failure of any other kind. Between them and
// the mutation row, everything loud on this surface is a row you cannot fold away.

/** A command that came back wears its icon and its line, and no word: `RAN` in front of the command
 * line says nothing the line and the terminal glyph have not already said. */
const RAN: RowMark = {
  Icon: TerminalWindowIcon,
  word: null,
  tone: 'text-foreground-soft',
  ring: '',
}

const RUNNING: RowMark = {
  Icon: TerminalWindowIcon,
  word: 'running',
  tone: 'text-tone-run',
  ring: '',
}

/** A failure wears its own mark whatever the call was for: a failed read is a failure first, and the
 * ring is what stops it reading as one more line of chatter. */
const FAILED: RowMark = {
  Icon: WarningIcon,
  word: 'failed',
  tone: 'text-tone-red',
  ring: FAILED_RING,
}

function callMark(status: ToolCallStatus): RowMark {
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

/** Why there is nothing to open. A call that is over printed nothing; one still going has not
 * printed yet, and the two are different facts about the same absence. */
function noOutputReason(status: ToolCallStatus): string {
  return status === 'completed' || status === 'failed'
    ? 'no output: this call printed nothing'
    : 'no output yet: this call has not come back'
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
  return (
    <LoudRow mark={callMark(row.status)} subject={subject(row)}>
      {row.output === null ? (
        <Text variant="code" className="text-foreground-faint">
          {noOutputReason(row.status)}
        </Text>
      ) : (
        <CallOutput output={row.output} defaultOpen={row.open} />
      )}
    </LoudRow>
  )
}
