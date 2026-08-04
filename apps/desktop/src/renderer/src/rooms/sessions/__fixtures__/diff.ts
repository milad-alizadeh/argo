import type { DiffHunk, DiffResult } from '@shared'

// The patch the fixture session's edit produced — the rotation core, extracted. Real code rather
// than `line 1 / line 2`: the feed's whole job is to be READ, so a placeholder hunk would hide
// whether one hunk is enough to see what an agent changed.

export const ROTATION_HUNKS: DiffHunk[] = [
  {
    oldStart: 1,
    newStart: 1,
    lines: [
      { side: 'add', text: "import { nextKey } from './keys'" },
      { side: 'add', text: '' },
      { side: 'add', text: 'export class Rotation {' },
      { side: 'add', text: '  #keys: string[] = [nextKey()]' },
      { side: 'add', text: '  current(): string {' },
      { side: 'add', text: '    return this.#keys[0]' },
    ],
  },
  {
    oldStart: 8,
    newStart: 14,
    lines: [
      { side: 'context', text: '  push(key: string): void {' },
      { side: 'del', text: '    this.keys.unshift(key)' },
      { side: 'add', text: '    this.#keys.unshift(key)' },
      { side: 'context', text: '  }' },
    ],
  },
]

/** A file that is gone: every line removed, nothing kept. The only shape a deletion ever arrives as,
 * since no CLI Argo reads has a delete tool. */
export const DELETED_HUNKS: DiffHunk[] = [
  {
    oldStart: 1,
    newStart: 0,
    lines: [
      { side: 'del', text: "export { verify } from './verify'" },
      { side: 'del', text: "export { rotate } from './rotation'" },
      { side: 'del', text: '' },
      { side: 'del', text: 'export const LEGACY = true' },
    ],
  },
]

export const aDiff = (over: Partial<DiffResult> = {}): DiffResult => ({
  kind: 'diff',
  tier: 'direct',
  change: 'modify',
  added: 6,
  removed: 1,
  hunks: ROTATION_HUNKS,
  ...over,
})
