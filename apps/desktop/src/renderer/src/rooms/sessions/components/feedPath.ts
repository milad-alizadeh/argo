// How a file path is READ on the feed, as two facts rather than one string: the name that
// identifies it, and the directory that disambiguates it.
//
// The feed renders one worktree, so every path on it shares the same fifty-odd characters of root.
// That prefix is not information — it is the same on every row of the whole surface — and it was
// consuming the width the filename needed while pushing the filename to a ragged right edge, at a
// different x on every row. A column you cannot read straight down is a column you re-read line by
// line, which is what made a wall of edits unskimmable even after the ellipsis moved to the head.
//
// So the root is stripped (it is stated once, in the session's own header) and what is left is split
// at the last separator. Nothing is invented and nothing is lost: the absolute path the record
// carried is still the model's, still on the row's tooltip, and still printed in full when the row
// is opened.

/** The path with `root` removed, when it is under it. Unchanged otherwise — a path outside the
 * session's own tree (a `/tmp` screenshot, a file in a sibling checkout) is NOT the same file as the
 * one at that relative position, and shortening it against a root it does not belong to would say it
 * was. */
export function relativeTo(path: string, root: string | null): string {
  if (root === null || root === '') return path
  const base = root.endsWith('/') ? root : `${root}/`
  return path.startsWith(base) ? path.slice(base.length) : path
}

/** What the row shows: the file's own name, and the directory holding it.
 *
 * `dir` is `null` rather than an empty string for a file at the root, so the caller renders nothing
 * instead of an empty cell that still spends its gap. A trailing separator means the path names a
 * DIRECTORY — there is no name to lift out of it, so it reads whole as the directory it is. */
export function splitPath(path: string, root: string | null): { name: string; dir: string | null } {
  const relative = relativeTo(path, root)
  const cut = relative.lastIndexOf('/')
  if (cut === -1) return { name: relative, dir: null }
  if (cut === relative.length - 1) return { name: relative, dir: null }
  return { name: relative.slice(cut + 1), dir: relative.slice(0, cut) }
}
