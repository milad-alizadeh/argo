import type { DiffHunk, DiffLine } from '@shared'
import { Text } from './Text'
import { useDisclosure } from './useDisclosure'

// The diff renderer both patch surfaces read: the Activity feed, which shows what ONE edit changed
// bounded to its first hunk, and Delivery Files, which shows a whole branch against its base. Their
// data differs and their presentation does not, and this repo fails a build on duplication.
//
// Delivery has not moved onto it yet — `domains/delivery/FileDiff` still draws its own hunks, and
// that domain is retired (issue 157) pending the rebuild in issue 271, which is the ticket that
// deletes the second renderer rather than migrating a surface being replaced.
//
// It renders a patch and NOTHING about where the patch came from. What a diff means — point-in-time
// for a feed row, current-state for Delivery — is the caller's to say, above this component, which
// is what keeps the sharing from making a feed diff read as an authoritative current-state view.

// The marker each side prints. Colour alone cannot carry meaning, and a diff already has its own
// notation for this — so the character is rendered rather than replaced by an icon.
const SIDE_MARKER: Readonly<Record<DiffLine['side'], string>> = { add: '+', del: '-', context: ' ' }

const SIDE_TONE: Readonly<Record<DiffLine['side'], string>> = {
  add: 'text-signal-ok',
  del: 'text-signal-bad',
  context: 'text-foreground-faint',
}

/** Where in the file a hunk picks up, so a bounded diff says WHERE it is showing and not just what.
 * Drawn only when a patch has more than one hunk — on a single-hunk diff it is a line of chrome
 * over the only thing there is to read. */
function HunkHead({ hunk }: { hunk: DiffHunk }): React.JSX.Element {
  return (
    <Text as="div" variant="code" className="text-foreground-faint">
      {`line ${hunk.newStart}`}
    </Text>
  )
}

function HunkLines({ hunk }: { hunk: DiffHunk }): React.JSX.Element {
  return (
    <Text as="div" variant="code" className="whitespace-pre-wrap break-words">
      {hunk.lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered patch — the position IS the line's identity.
        <span key={index} className={SIDE_TONE[line.side]}>
          {`${SIDE_MARKER[line.side]}${line.text}`}
          {index < hunk.lines.length - 1 ? '\n' : ''}
        </span>
      ))}
    </Text>
  )
}

function boundLabel(hidden: number, open: boolean): string {
  if (open) return 'show less'
  return hidden === 1 ? 'show 1 more hunk' : `show ${hidden} more hunks`
}

/**
 * Molecule: one patch, rendered — its hunks in order, bounded to a count the caller sets.
 *
 * The bound is a PROP rather than a constant here because the two callers want different ones: a
 * feed row shows the first hunk so one 400-line edit cannot bury the paragraph explaining it, and a
 * review surface shows the whole file. Whatever is over the bound opens in place, so reading the
 * rest never costs you your position in what you were reading.
 *
 * A patch with no hunks says so. A binary file and an unreadable one both land here, and an empty
 * block would read as "nothing changed" — which is the one thing it does not mean.
 */
export function DiffView({
  hunks,
  maxHunks,
}: {
  /** The patch, in file order. */
  hunks: readonly DiffHunk[]
  /** How many hunks show before the rest go behind an affordance. Undefined shows them all. */
  maxHunks?: number
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: false })
  const bound = maxHunks === undefined ? hunks.length : Math.min(maxHunks, hunks.length)
  const hidden = hunks.length - bound
  const shown = open ? hunks : hunks.slice(0, bound)

  if (hunks.length === 0) {
    return (
      <Text variant="code" className="text-foreground-faint">
        no diff available
      </Text>
    )
  }

  return (
    <div data-component="DiffView" className="flex flex-col gap-tight">
      {shown.map((hunk) => (
        <div key={`${hunk.oldStart}:${hunk.newStart}`} className="flex flex-col">
          {hunks.length > 1 && <HunkHead hunk={hunk} />}
          <HunkLines hunk={hunk} />
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          <Text variant="code" className="text-foreground-faint underline underline-offset-2">
            {boundLabel(hidden, open)}
          </Text>
        </button>
      )}
    </div>
  )
}
