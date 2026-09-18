// Codex's `apply_patch` carries its change as one text (codex-rs/apply-patch): `*** Begin Patch`,
// then per file `*** Add File: p`, `*** Update File: p` (optionally `*** Move to: p`) or
// `*** Delete File: p`, hunks under bare `@@` lines, and `*** End Patch`.
export const PATCH_FILE_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/
const FILE_HEADER = PATCH_FILE_HEADER

export type PatchChange = {
  kind: 'created' | 'edited'
  label: string
  diff: string
  lineCounts: { added: number; removed: number }
}

const VERBS = { Add: 'Created', Update: 'Edited', Delete: 'Deleted' } as const

function fileName(path: string) {
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

export function readPatch(patch: string): PatchChange | null {
  const lines = patch.split('\n')
  const headers = lines.flatMap((line) => {
    const match = FILE_HEADER.exec(line)
    return match === null ? [] : [{ verb: match[1] as keyof typeof VERBS, path: match[2] ?? '' }]
  })
  const [first] = headers
  if (first === undefined) return null
  const body = lines.filter((line) => !/^\*\*\* (Begin|End) Patch$/.test(line))
  // The diff viewer reads `@@ -n +n @@` to number lines; a bare `@@` numbers from nothing.
  const diff = body
    .map((line) => (line.startsWith('@@') ? '@@ -0,0 +0,0 @@' : line))
    .map((line) => (FILE_HEADER.test(line) ? line.slice('*** '.length) : line))
    .join('\n')
  const added = body.filter((line) => line.startsWith('+')).length
  const removed = body.filter((line) => line.startsWith('-')).length
  const label =
    headers.length === 1
      ? `${VERBS[first.verb]} ${fileName(first.path)}`
      : `Edited ${headers.length} files`
  return {
    kind: headers.length === 1 && first.verb === 'Add' ? 'created' : 'edited',
    label,
    diff,
    lineCounts: { added, removed },
  }
}
