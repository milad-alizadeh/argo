import { splitPath } from './feedPath'

// A file path in a feed row: its NAME first, then the directory holding it, dimmed.
//
// Name-first is the whole point. Head-truncation kept the filename alive but left it at the row's
// ragged RIGHT edge — a different x on every row, because paths are different lengths — so a column
// of edits had to be read line by line. The one token that differs now sits in a fixed position at
// the head of the cell, left-aligned and bright, and the column reads straight down. That is the
// same reason VS Code's quick-open and GitHub's search put the filename first.
//
// The directory is kept rather than dropped, because a filename ALONE is not an identifier: this
// repo has some twenty `index.ts`, and two rows both reading `index.ts` say strictly less than two
// paths did. It is what remains after the session's own root is stripped, so it is short enough to
// stand beside the name — which is what makes name-first affordable at all.
//
// THE DIRECTORY STILL CUTS FROM ITS HEAD, and that mechanism is unchanged, because what identifies
// a directory is its deepest part. Both halves are load-bearing:
//
//   `dir="rtl"`        moves the overflow — and so the ellipsis — to the visual LEFT.
//   `text-align: left` puts a directory SHORTER than its cell back on the left edge, where rtl
//                      alignment would otherwise strand it against the right.
//
// And the leading LRM. Under `rtl`, a neutral character at either edge of the string takes the
// paragraph's direction rather than the text's, so a leading `/` jumps to the far end and
// `/tmp/shots` renders as `tmp/shots/` — quietly, unreadably wrong. Prefixing an invisible
// strong-LTR mark means the `/` is no longer at an edge and stays where it was written.

/** U+200E LEFT-TO-RIGHT MARK. Invisible, zero-width, and strong — see the note above. */
const LRM = '‎'

/**
 * Atom: the subject cell of a row that names a file.
 *
 * `root` is the session's own working directory, and the path is shown relative to it. Absent
 * (`null`) the path renders whole — an unknown root is not a reason to guess at a shorter one.
 *
 * `absent` is the caller's words for a record that named no path — the row still renders, because a
 * change Argo cannot name is still a change that happened, and dropping it would be the one thing
 * worse than not naming it.
 */
export function PathSubject({
  path,
  root,
  absent,
}: {
  path: string | null
  root: string | null
  absent: string
}): React.JSX.Element {
  if (path === null) return <span className="text-foreground-faint">{absent}</span>
  const { name, dir } = splitPath(path, root)
  return (
    // `title` carries the path the record actually gave, absolute and unshortened — the answer to
    // "which of the two checkouts is this", which the row itself deliberately stops saying.
    <span className="flex min-w-0 items-baseline gap-snug" title={path}>
      {/* Never truncated. It is the reason the row exists, it is short, and a `…tsx` would defeat
          the entire arrangement. */}
      <span className="shrink-0 text-foreground">{name}</span>
      {dir !== null && (
        <span dir="rtl" className="block min-w-0 flex-1 truncate text-left text-foreground-faint">
          {`${LRM}${dir}`}
        </span>
      )}
    </span>
  )
}
