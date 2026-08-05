import type { DiffResult, FileChange, MutationRowModel, ToolCallStatus } from '@shared'
import { cn } from '@/lib/utils'
import {
  DiffView,
  FileMinusIcon,
  FilePlusIcon,
  FileTextIcon,
  PencilSimpleIcon,
  Text,
} from '@/shared/components/ui'
import { CallOutput } from './CallOutput'
import { relativeTo } from './feedPath'
import { inkFor } from './minimapMatrix'
import { PathSubject } from './PathSubject'
import { BODY_INSET } from './rowRecipes'
import { type RowMark, ToolRow } from './ToolRow'

// The feed's loud row. Everything else on this surface is something the agent SAID; this is
// something it DID to your code — so it cannot be folded away, and it wears a stub in the margin
// that survives a scroll at speed. Its DIFF is behind the row's caret like every other row's body:
// open-by-default put fifty patches in one column, which made the feed a wall of code with the
// prose that explains it lost between the walls, and painted the minimap teal end to end.

/** How many hunks a feed row shows before the rest go behind an affordance.
 *
 * ONE, because prose is the primary row here: a single 400-line edit rendered whole would bury the
 * paragraph that explains it, which is the failure this whole surface exists to correct. The rest
 * is one click away and opens in place. Delivery's own diff sets a different bound, which is why
 * `DiffView` takes it rather than deciding it. */
const FEED_HUNK_BOUND = 1

// A creation and a deletion are as distinct as a modification: icon and word for all three, and all
// three wear the MUTATION ink — the same teal the strip paints and a diff's added lines wear. What
// earns that colour is that your code changed, which is equally true of all three. A deletion keeps
// its own red word, because gone is a different fact from changed.
const CHANGE_MARKS: Readonly<Record<FileChange, RowMark>> = {
  create: {
    Icon: FilePlusIcon,
    word: 'Create',
    tone: inkFor('mutation'),
  },
  modify: {
    Icon: FileTextIcon,
    word: 'Edit',
    tone: inkFor('mutation'),
  },
  delete: {
    Icon: FileMinusIcon,
    word: 'Delete',
    tone: 'text-signal-bad',
  },
}

/** A call that has not come back, and one that came back broken. Neither has a change to name yet.
 * The pencil survives on the failure because WHAT failed is the fact the row adds — the surface's
 * other rows fail too, and this one failed at editing. */
const RUNNING_MARK: RowMark = {
  Icon: PencilSimpleIcon,
  word: 'Edit',
  tone: inkFor('mutation'),
  live: true,
}

const FAILED_MARK: RowMark = {
  Icon: PencilSimpleIcon,
  word: 'Failed',
  tone: inkFor('mutation', true),
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
 * replaces forty are different changes, and a single number cannot tell them apart.
 *
 * A COLUMN before the path, not a count held to the row's right edge. On the edge it was ragged —
 * its position was set by the length of the path beside it, so a run of edits scattered the one
 * number you scan a wall of them by across the width of the pane. Here it is a fixed cell like the
 * verb, LEFT-aligned like every other cell on the row: right-aligned, the `+` moved with the width
 * of the number beside it, so the one character that says "added" sat at a different x on every row
 * while the paths stayed put. `8ch` fits four digits a side; a bigger patch pushes the paths out
 * together rather than clipping. */
function Churn({ diff }: { diff: DiffResult }): React.JSX.Element {
  return (
    <Text variant="meta" className="min-w-[8ch] shrink-0 tabular-nums">
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
export function MutationRow({
  row,
  root,
}: {
  row: MutationRowModel
  root: string | null
}): React.JSX.Element {
  const { path, status, diff } = row
  return (
    <ToolRow
      mark={changeMark(status, diff)}
      subject={
        <span className="flex min-w-0 items-baseline gap-snug">
          {diff !== null && <Churn diff={diff} />}
          <PathSubject path={path} root={root} absent="a file the record did not name" />
        </span>
      }
      // A patch reaches the box's edges. It has a line-number gutter of its own to align, and its
      // +/- bands only read as bands when they span the full width — inset, they stripe short of the
      // border and the gutter answers to nothing. The prose that can accompany one comes back to the
      // column itself, below.
      body="flush"
      origin={path === null ? null : relativeTo(path, root)}
    >
      {mutationBody(row)}
    </ToolRow>
  )
}

/** Everything the row opens onto, in one place so `ToolRow` can ask whether there IS anything —
 * a row with no patch, no output and nothing to explain must render inert rather than as a caret
 * onto an empty box. `null`, not an empty fragment, because a fragment is truthy. */
function mutationBody({ path, status, diff, output }: MutationRowModel): React.ReactNode {
  if (status === 'pending' || status === 'in_progress') {
    return (
      <Text variant="code" className={cn(BODY_INSET, 'text-foreground-faint')}>
        no result yet: this change has not been reported back
      </Text>
    )
  }
  if (diff === null && output === null) {
    return (
      <Text variant="code" className={cn(BODY_INSET, 'text-foreground-faint')}>
        {missingDiffReason(status)}
      </Text>
    )
  }
  return (
    <>
      {/* Unframed: the row's opened box is the boundary, and a patch bringing its own would nest a
          border inside a border. */}
      {diff !== null && (
        <DiffView hunks={diff.hunks} maxHunks={FEED_HUNK_BOUND} path={path} framed={false} />
      )}
      {/* What the call printed — for a FAILED change, the only thing that says why it did not land.
          Back on the prose column the patch above it gave up: it has no gutter of its own to line
          up, so at the box's edge it would be the one block on the surface starting nowhere. */}
      {output !== null && (
        <div className={BODY_INSET}>
          <CallOutput output={output} />
        </div>
      )}
    </>
  )
}
