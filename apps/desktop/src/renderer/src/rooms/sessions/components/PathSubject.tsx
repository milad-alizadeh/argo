// A file path in a row narrower than the path. It is cut from the START, so the ellipsis leads and
// what survives is the end: `…cket-318/apps/desktop/src/shared/feedRows.ts`.
//
// Cutting from the END is the browser's default and the worst possible cut here. Every path in one
// worktree shares fifty-odd characters of prefix, so a column of edits renders the SAME string on
// every row — `/Users/me/Developer/argo/.claude/worktrees/ticket-318-inl…` — with the one word that
// identifies each of them dropped. Cutting the middle keeps that worthless prefix; cutting the head
// spends the whole width on the part that differs.
//
// THE MECHANISM, and both halves are load-bearing:
//
//   `dir="rtl"`        moves the overflow — and so the ellipsis — to the visual LEFT.
//   `text-align: left` puts a path SHORTER than the row back on the left edge, where rtl alignment
//                      would otherwise strand it against the right.
//
// And the leading LRM. Under `rtl`, a neutral character at either edge of the string takes the
// paragraph's direction rather than the text's, so a leading `/` jumps to the far end and
// `/Users/me/x.ts` renders as `Users/me/x.ts/` — a path that is quietly, unreadably wrong. Prefixing
// an invisible strong-LTR mark means the `/` is no longer at an edge and stays where it was written.
// It costs one clipped character on a path long enough to truncate, where it is inside the ellipsis
// anyway. All four cases (absolute, relative, bare name, very long) are verified in the stories.

/** U+200E LEFT-TO-RIGHT MARK. Invisible, zero-width, and strong — see the note above. */
const LRM = '‎'

/**
 * Atom: the subject cell of a row that names a file.
 *
 * ONE tone, not a dirname/filename split. The tail is the part that identifies the file and the
 * tail is what always survives the cut, so a second colour would be emphasis spent on a distinction
 * the truncation already makes.
 *
 * `absent` is the caller's words for a record that named no path — the row still renders, because a
 * change Argo cannot name is still a change that happened, and dropping it would be the one thing
 * worse than not naming it.
 */
export function PathSubject({
  path,
  absent,
}: {
  path: string | null
  absent: string
}): React.JSX.Element {
  if (path === null) return <span className="text-foreground-faint">{absent}</span>
  return (
    // `block` is not cosmetic. This lands in two kinds of parent — a flex row (a folded call, a
    // command's name-plus-target) and a plain block cell (a mutation's subject, which is a path and
    // nothing else). As an INLINE span it shrank to its text in the block case, so the cell's own
    // LTR `truncate` cut the tail off and the leading ellipsis never appeared: an edit rendered the
    // fifty shared characters of worktree prefix and dropped the filename. Block, it fills the cell
    // and does its own cutting in either parent — and `flex-1` still governs it as a flex item.
    <span dir="rtl" className="block min-w-0 flex-1 truncate text-left text-foreground">
      {`${LRM}${path}`}
    </span>
  )
}
