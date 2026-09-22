import type { EditedFile } from '@/domains/sessions/contract/model'

// Codex's `apply_patch` carries its change as one text (codex-rs/apply-patch): `*** Begin Patch`,
// then per file `*** Add File: p`, `*** Update File: p` (optionally `*** Move to: p`) or
// `*** Delete File: p`, hunks under bare `@@` lines, and `*** End Patch`.
const FILE_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/
const ENVELOPE = /^\*\*\* (Begin|End) Patch$/

const CHANGES = { Add: 'create', Update: 'update', Delete: 'delete' } as const

// Each file's diff opens with its `Update File: p` line, which the diff viewer splits on, and
// its bare `@@` becomes a hunk header the viewer can number lines from.
export function readPatchFiles(patch: string): EditedFile[] {
  const files: (EditedFile & { lines: string[] })[] = []
  for (const line of patch.split('\n')) {
    const header = FILE_HEADER.exec(line)
    if (header !== null) {
      const verb = header[1] as keyof typeof CHANGES
      files.push({
        change: CHANGES[verb],
        file: header[2] ?? null,
        diff: '',
        lineCounts: { added: 0, removed: 0 },
        lines: [line.slice('*** '.length)],
      })
      continue
    }
    const current = files.at(-1)
    if (current === undefined || ENVELOPE.test(line)) continue
    current.lines.push(line.startsWith('@@') ? '@@ -0,0 +0,0 @@' : line)
    if (line.startsWith('+')) current.lineCounts.added += 1
    if (line.startsWith('-')) current.lineCounts.removed += 1
  }
  return files.map(({ lines, ...file }) => ({ ...file, diff: lines.join('\n') }))
}
