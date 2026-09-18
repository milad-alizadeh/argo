// A diff the evidence panel draws, split per file. An `apply_patch` diff (`apply-patch.ts`) opens
// each file with an `Update File: p` line, so a patch over several files reads as several
// sections; an Edit or Write diff carries no such line and is one section under the row's title.
const FILE_LINE = /^(Add|Update|Delete) File: (.+)$/

export type PatchFile = { verb: 'Add' | 'Update' | 'Delete' | null; path: string; diff: string }

export function patchFiles(source: string, title: string): PatchFile[] {
  const files: PatchFile[] = []
  for (const line of source.replace(/\n$/, '').split('\n')) {
    const match = FILE_LINE.exec(line)
    if (match !== null) {
      files.push({ verb: match[1] as PatchFile['verb'], path: match[2] ?? '', diff: '' })
      continue
    }
    const current = files.at(-1) ?? { verb: null, path: title, diff: '' }
    if (files.length === 0) files.push(current)
    current.diff = current.diff === '' ? line : `${current.diff}\n${line}`
  }
  return files
}
