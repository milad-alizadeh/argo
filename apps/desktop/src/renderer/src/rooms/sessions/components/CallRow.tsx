import type { CallRowModel, ToolCallStatus } from '@shared'
import { TerminalWindowIcon, Text, WarningIcon } from '@/shared/components/ui'
import { CallOutput } from './CallOutput'
import { inkFor } from './minimapMatrix'
import { PathSubject } from './PathSubject'
import { type RowMark, ToolRow } from './ToolRow'

// The row a single call earns: a command, always, and a failure of any other kind. Between them and
// the mutation row, everything loud on this surface is a row you cannot fold away.

// ONE verb whatever the state: "Run", sentence case. A call that is still going says so with the
// session's pulsing run dot beside the verb, never by changing the verb's tense.
const RAN: RowMark = {
  Icon: TerminalWindowIcon,
  word: 'Run',
  // The strip's own ink for a `call`, so the tick beside this row and this row are one colour.
  tone: inkFor('call'),
}

const RUNNING: RowMark = {
  Icon: TerminalWindowIcon,
  word: 'Run',
  tone: 'text-tone-run',
  live: true,
}

/** A failure wears its own mark whatever the call was for: a failed read is a failure first, and
 * the red is what stops it reading as one more line of chatter. */
const FAILED: RowMark = {
  Icon: WarningIcon,
  word: 'Failed',
  tone: inkFor('call', true),
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
function Subject({ row }: { row: CallRowModel }): React.JSX.Element {
  // A command line is not a path — it has slashes in it and no filename to lead with, so it reads
  // whole and unsplit. Everything else here names a FILE, and gets the filename-first reading.
  if (row.callKind === 'execute') {
    return <span>{row.target ?? 'a command the record did not name'}</span>
  }
  return (
    <span className="inline-flex min-w-0 max-w-full items-baseline gap-snug">
      <span className="shrink-0 text-foreground-faint">{row.name}</span>
      <PathSubject path={row.target} absent="nothing the record named" />
    </span>
  )
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
 * scanned without wading through build logs — a failure included: its mark and its ring say what
 * happened on the closed row, and only the text behind them is a click away.
 */
export function CallRow({ row }: { row: CallRowModel }): React.JSX.Element {
  return (
    <ToolRow mark={callMark(row.status)} subject={<Subject row={row} />}>
      {row.output === null ? (
        // The ABSENCE is a body like any other: it sits behind the caret rather than on the line,
        // so a row that printed nothing is the same one line tall as a row that printed a log.
        <Text variant="code" className="text-foreground-faint">
          {noOutputReason(row.status)}
        </Text>
      ) : (
        <CallOutput output={row.output} />
      )}
    </ToolRow>
  )
}
