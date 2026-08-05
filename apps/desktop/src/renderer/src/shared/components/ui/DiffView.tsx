import type { DiffHunk } from '@shared'
import { languageOf } from './codeHighlight'
import { DiffLines } from './DiffLines'
import { Text } from './Text'
import { useDisclosure } from './useDisclosure'

// The diff renderer both patch surfaces read: the Activity feed, which shows what ONE edit changed
// bounded to its first hunk, and Delivery Files, which shows a whole branch against its base. Their
// data differs and their presentation does not, and this repo fails a build on duplication.
//
// Both surfaces are on it: `MutationRow` bounds itself to the first hunk, `domains/delivery/FileDiff`
// shows the file whole. There is one patch renderer in the app, and adding a third caller means
// passing a different bound, not writing the lines out again.
//
// It renders a patch and NOTHING about where the patch came from. What a diff means — point-in-time
// for a feed row, current-state for Delivery — is the caller's to say, above this component, which
// is what keeps the sharing from making a feed diff read as an authoritative current-state view.

/** Where in the file a hunk picks up. Now that every line carries its own number this is the
 * SEPARATOR between hunks rather than a signpost — drawn only between them, because the first
 * hunk's start is already the first number in its own gutter. */
function HunkGap(): React.JSX.Element {
  return <div aria-hidden className="my-tight h-px bg-foreground/10" />
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
  path,
  framed = true,
}: {
  /** The patch, in file order. */
  hunks: readonly DiffHunk[]
  /** How many hunks show before the rest go behind an affordance. Undefined shows them all. */
  maxHunks?: number
  /** The file the patch is against — read for its grammar and nothing else. A patch whose file
   * this app carries no grammar for renders as plain text rather than as a guess. */
  path?: string | null
  /** Whether the patch draws its own border.
   *
   * `false` where the CALLER already provides one — the Activity feed, where every opened row shares
   * one box so that a diff and a command's output look like the same thing opened. Framed by default
   * because Delivery drops a patch straight onto a pane with nothing around it. Two boxes nested one
   * inside the other is the double-border this exists to prevent. */
  framed?: boolean
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

  const language = languageOf(path ?? null)
  return (
    <div
      data-component="DiffView"
      className={framed ? 'flex flex-col overflow-hidden rounded-md inset-card' : 'flex flex-col'}
    >
      {shown.map((hunk, index) => (
        <div key={`${hunk.oldStart}:${hunk.newStart}`} className="flex flex-col">
          {index > 0 && <HunkGap />}
          <DiffLines hunk={hunk} language={language} />
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
