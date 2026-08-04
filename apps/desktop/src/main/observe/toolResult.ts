import type { DiffHunk, DiffLine, DiffResult, FileChange } from '../../shared'
import { asArray, asNumber, asString, isRecord } from './untrusted'

// A mutating call's result → the Diff it produced, read off `toolUseResult`. DIRECT, and never
// re-read from disk, which is what makes a feed diff point-in-time.

/** The marker a patch line carries, and the side it means. */
const SIDE_BY_MARKER: Readonly<Record<string, DiffLine['side']>> = {
  '+': 'add',
  '-': 'del',
  ' ': 'context',
}

/** One patch line with its marker taken OFF, since the side carries it. A line with no marker keeps
 * every character: it is context, and slicing it would eat a real one. */
function diffLine(raw: unknown): DiffLine | null {
  const text = asString(raw)
  if (text === null) return null
  const side = SIDE_BY_MARKER[text.slice(0, 1)]
  return side === undefined ? { side: 'context', text } : { side, text: text.slice(1) }
}

function hunkFrom(raw: unknown): DiffHunk | null {
  if (!isRecord(raw)) return null
  const lines = asArray(raw.lines).flatMap((line) => {
    const parsed = diffLine(line)
    return parsed === null ? [] : [parsed]
  })
  if (lines.length === 0) return null
  return { oldStart: asNumber(raw.oldStart) ?? 0, newStart: asNumber(raw.newStart) ?? 0, lines }
}

/** The whole content of a file as one all-added hunk. A `Write` that creates reports an EMPTY patch
 * with the content beside it, and rendering nothing would hide a whole new file. */
function wholeFileHunk(content: string): DiffHunk | null {
  const lines = content.split('\n')
  // A trailing newline splits into a final empty element that is not a line of the file.
  if (lines.at(-1) === '') lines.pop()
  if (lines.length === 0) return null
  return { oldStart: 0, newStart: 1, lines: lines.map((text) => ({ side: 'add', text })) }
}

const countSide = (hunks: readonly DiffHunk[], side: DiffLine['side']): number =>
  hunks.reduce((total, hunk) => total + hunk.lines.filter((line) => line.side === side).length, 0)

/** What the record says about the file, either side of the change. `after` is `null` where the host
 * reported no resulting content (an `Edit`, which reports only the strings it swapped). */
interface FileSnapshot {
  before: string
  after: string | null
}

/** What the change did to the file, where the host declared nothing. A deletion is claimed only from
 * a patch that removes lines and keeps none: no CLI Argo reads has a delete tool, so that shape is
 * the only evidence one leaves. `modify` is the fallback — neither creation nor deletion is worth
 * claiming from an absence of evidence. */
function fileChange(hunks: readonly DiffHunk[], { before, after }: FileSnapshot): FileChange {
  if (before === '' && countSide(hunks, 'add') > 0) return 'create'
  if (before !== '' && after === '') return 'delete'
  const removesOnly =
    hunks.length > 0 && countSide(hunks, 'add') + countSide(hunks, 'context') === 0
  return removesOnly ? 'delete' : 'modify'
}

/** The host's OWN word for what it did, where it writes one (`Write` reports `create` / `update`).
 * Preferred over the patch: a verbatim read beats an inference from the same record. */
function declaredChange(raw: unknown): FileChange | null {
  switch (asString(raw)) {
    case 'create':
      return 'create'
    case 'update':
      return 'modify'
    default:
      return null
  }
}

/**
 * A record's `toolUseResult` → the Diff a mutating call produced, or `null` where it carried no
 * patch at all (the call was not a mutation, or the host reported nothing about it).
 *
 * A result that IS a mutation but whose patch cannot be read — a binary file, a shape this cannot
 * parse — comes back with zero hunks and a zero churn rather than as `null`: the mutation happened,
 * and a row that says "no diff available" is honest where a missing row is not.
 */
export function diffResultFrom(raw: unknown): DiffResult | null {
  if (!isRecord(raw) || !('structuredPatch' in raw)) return null
  const patch = asArray(raw.structuredPatch).flatMap((entry) => {
    const hunk = hunkFrom(entry)
    return hunk === null ? [] : [hunk]
  })
  const after = asString(raw.content)
  const created = patch.length === 0 && after !== null ? wholeFileHunk(after) : null
  const hunks = created === null ? patch : [created]
  const declared = declaredChange(raw.type)
  return {
    kind: 'diff',
    tier: 'direct',
    change: declared ?? fileChange(hunks, { before: asString(raw.originalFile) ?? '', after }),
    added: countSide(hunks, 'add'),
    removed: countSide(hunks, 'del'),
    hunks,
  }
}
