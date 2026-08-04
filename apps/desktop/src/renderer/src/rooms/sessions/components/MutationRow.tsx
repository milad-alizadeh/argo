import type { DiffResult, FeedRow, FileChange, ToolCallStatus } from '@shared'
import { cn } from '@/lib/utils'
import {
  DiffView,
  FileMinusIcon,
  FilePlusIcon,
  FileTextIcon,
  type IconAtom,
  PencilSimpleIcon,
  Text,
} from '@/shared/components/ui'

// The feed's loud row. Everything else on this surface is something the agent SAID; this is
// something it DID to your code, so it renders its diff with no click and cannot be folded away.

/** How many hunks a feed row shows before the rest go behind an affordance.
 *
 * ONE, because prose is the primary row here: a single 400-line edit rendered whole would bury the
 * paragraph that explains it, which is the failure this whole surface exists to correct. The rest
 * is one click away and opens in place. Delivery's own diff sets a different bound, which is why
 * `DiffView` takes it rather than deciding it. */
const FEED_HUNK_BOUND = 1

interface ChangeMark {
  Icon: IconAtom
  /** The word the row wears, in the vocabulary of what happened to the FILE. */
  word: string
  tone: string
  rail: string
}

// A creation and a deletion are as distinct as a modification, in three channels at once — icon,
// word and rail — because a deleted file scrolled past unnoticed is the most expensive thing this
// feed can do. Written out literally so Tailwind's scanner still sees each class.
const CHANGE_MARKS: Readonly<Record<FileChange, ChangeMark>> = {
  create: {
    Icon: FilePlusIcon,
    word: 'created',
    tone: 'text-signal-ok',
    rail: 'border-l-signal-ok',
  },
  modify: {
    Icon: FileTextIcon,
    word: 'edited',
    tone: 'text-foreground-soft',
    rail: 'border-l-inset-hair',
  },
  delete: {
    Icon: FileMinusIcon,
    word: 'deleted',
    tone: 'text-signal-bad',
    rail: 'border-l-signal-bad',
  },
}

/** What a mutation with no diff to show is: still running, or over and reported nothing. A pending
 * call is NEVER dressed as a finished one — the result may still be coming, and it may never come. */
const UNRESOLVED_MARKS: Readonly<Record<'pending' | 'failed', ChangeMark>> = {
  pending: {
    Icon: PencilSimpleIcon,
    word: 'editing',
    tone: 'text-tone-run',
    rail: 'border-l-tone-run',
  },
  failed: {
    Icon: PencilSimpleIcon,
    word: 'failed',
    tone: 'text-tone-red',
    rail: 'border-l-tone-red',
  },
}

function changeMark(status: ToolCallStatus, diff: DiffResult | null): ChangeMark {
  if (diff !== null) return CHANGE_MARKS[diff.change]
  return status === 'failed' ? UNRESOLVED_MARKS.failed : UNRESOLVED_MARKS.pending
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
 * The caption under the diff is load-bearing rather than decorative. This component and Delivery's
 * Files view share one renderer, and the two show different things: Delivery's diff is the branch
 * against its base and is current, while this is what ONE edit changed at the moment it was made —
 * a later edit to the same file does not update it, and the file on disk may look nothing like it
 * now. Sharing the renderer must not make this row read as the authoritative one.
 */
export function MutationRow({
  row,
}: {
  row: Extract<FeedRow, { kind: 'mutation' }>
}): React.JSX.Element {
  const { path, status, diff } = row
  const { Icon, word, tone, rail } = changeMark(status, diff)
  return (
    <div className={cn('flex flex-col gap-tight border-l-2 pl-inset', rail)}>
      <div className="flex items-baseline gap-snug">
        <Text aria-hidden variant="prose" className={cn('shrink-0', tone)}>
          <Icon className="icon-sm" />
        </Text>
        <Text variant="code" className={cn('shrink-0 uppercase', tone)}>
          {word}
        </Text>
        <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-soft">
          {path ?? 'a file the record did not name'}
        </Text>
        {diff !== null && <Churn diff={diff} />}
      </div>
      {diff === null ? (
        <Text variant="code" className="text-foreground-faint">
          {status === 'failed'
            ? 'no diff available: the call failed before it reported one'
            : 'no result yet: this change has not been reported back'}
        </Text>
      ) : (
        <>
          <DiffView hunks={diff.hunks} maxHunks={FEED_HUNK_BOUND} />
          <Text variant="meta" className="text-foreground-faint">
            what this change did, when it was made · not the file as it is now
          </Text>
        </>
      )}
    </div>
  )
}
