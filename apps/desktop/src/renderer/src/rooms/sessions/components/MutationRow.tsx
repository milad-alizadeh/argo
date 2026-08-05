import type { DiffResult, FileChange, MutationRowModel, ToolCallStatus } from '@shared'
import {
  DiffView,
  FileMinusIcon,
  FilePlusIcon,
  FileTextIcon,
  PencilSimpleIcon,
  Text,
} from '@/shared/components/ui'
import { CallOutput } from './CallOutput'
import { FAILED_RING, LoudRow, type RowMark } from './LoudRow'

// The feed's loud row. Everything else on this surface is something the agent SAID; this is
// something it DID to your code, so it renders its diff with no click and cannot be folded away.

/** How many hunks a feed row shows before the rest go behind an affordance.
 *
 * ONE, because prose is the primary row here: a single 400-line edit rendered whole would bury the
 * paragraph that explains it, which is the failure this whole surface exists to correct. The rest
 * is one click away and opens in place. Delivery's own diff sets a different bound, which is why
 * `DiffView` takes it rather than deciding it. */
const FEED_HUNK_BOUND = 1

// A creation and a deletion are as distinct as a modification: icon and word for all three, and a
// ring for the deletion, because a deleted file scrolled past unnoticed is the most expensive thing
// this feed can do. Written out literally so Tailwind's scanner still sees each class.
const CHANGE_MARKS: Readonly<Record<FileChange, RowMark>> = {
  create: { Icon: FilePlusIcon, word: 'Create', tone: 'text-signal-ok', ring: '' },
  modify: { Icon: FileTextIcon, word: 'Edit', tone: 'text-foreground-soft', ring: '' },
  delete: {
    Icon: FileMinusIcon,
    word: 'Delete',
    tone: 'text-signal-bad',
    ring: 'ring-1 ring-inset ring-signal-bad/25',
  },
}

/** A call that has not come back, and one that came back broken. Neither has a change to name yet.
 * The pencil survives on the failure because WHAT failed is the fact the row adds — the surface's
 * other rows fail too, and this one failed at editing. */
const RUNNING_MARK: RowMark = {
  Icon: PencilSimpleIcon,
  word: 'Edit',
  tone: 'text-tone-run',
  ring: '',
  live: true,
}

const FAILED_MARK: RowMark = {
  Icon: PencilSimpleIcon,
  word: 'Failed',
  tone: 'text-tone-red',
  ring: FAILED_RING,
}

/**
 * The mark a row wears, decided by the call's STATUS first and its patch second.
 *
 * Status first because the two are independent: a finished call can report no patch (a binary
 * file), and reading "no patch" as "still running" would dress a call that is over as one that is
 * live — the same false-active the honesty tier exists to prevent, in the other direction.
 */
function changeMark(status: ToolCallStatus, diff: DiffResult | null): RowMark {
  switch (status) {
    case 'pending':
    case 'in_progress':
      return RUNNING_MARK
    case 'failed':
      return FAILED_MARK
    case 'completed':
      return diff === null ? CHANGE_MARKS.modify : CHANGE_MARKS[diff.change]
  }
}

/** Why there is no patch under a row that has one to give. Absent for a call still running, whose
 * body says so instead, and for a failure that printed WHY — that text is the better answer, and it
 * replaces this line rather than sitting above it. */
function missingDiffReason(status: ToolCallStatus): string {
  return status === 'failed'
    ? 'no diff available: the call failed before it reported one'
    : 'no diff available: the record carried no patch for this change'
}

/** The churn, as two counts rather than one total: a change that adds forty lines and one that
 * replaces forty are different changes, and a single number cannot tell them apart. */
function Churn({ diff }: { diff: DiffResult }): React.JSX.Element {
  return (
    <Text variant="meta" className="shrink-0 tabular-nums">
      <span className="text-signal-ok">{`+${diff.added}`}</span>{' '}
      <span className="text-signal-bad">{`-${diff.removed}`}</span>
    </Text>
  )
}

/**
 * Organism: one change the agent made to a file, with its diff inline.
 *
 * What this shows is POINT-IN-TIME: what one edit changed at the moment it was made. A later edit to
 * the same file does not update it, and the file on disk may look nothing like it now. The row says
 * so through its own grammar rather than through a caption — a past-tense verb on a dated row in a
 * chronological feed — because a sentence repeated under every diff on the surface stops being read
 * long before the surface stops needing it understood.
 *
 * That distinction still matters: this shares a renderer with Delivery's Files view, whose diff IS
 * the branch against its base and IS current.
 */
export function MutationRow({ row }: { row: MutationRowModel }): React.JSX.Element {
  const { path, status, diff, output, open } = row
  const running = status === 'pending' || status === 'in_progress'
  return (
    <LoudRow
      mark={changeMark(status, diff)}
      subject={path ?? 'a file the record did not name'}
      trailing={diff !== null && <Churn diff={diff} />}
    >
      {running && (
        <Text variant="code" className="text-foreground-faint">
          no result yet: this change has not been reported back
        </Text>
      )}
      {!running && diff === null && output === null && (
        <Text variant="code" className="text-foreground-faint">
          {missingDiffReason(status)}
        </Text>
      )}
      {diff !== null && <DiffView hunks={diff.hunks} maxHunks={FEED_HUNK_BOUND} />}
      {/* What the call printed, where it printed anything: for a FAILED change that text is the only
          thing that says why the edit did not land, so the derivation opens it. */}
      {output !== null && <CallOutput output={output} defaultOpen={open} />}
    </LoudRow>
  )
}
