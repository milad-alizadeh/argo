import { describe, expect, it } from 'vitest'
import { diffResultFrom } from './toolResult'

// The shapes below are what Claude Code actually writes to `toolUseResult`: `Edit` reports the
// strings it swapped plus a patch, `Write` reports the resulting content and its own `type`.

const patch = (lines: string[], over: Record<string, unknown> = {}) => ({
  oldStart: 12,
  oldLines: 3,
  newStart: 12,
  newLines: 4,
  lines,
  ...over,
})

describe('diffResultFrom', () => {
  it('reads a patch into sided lines with the markers taken off', () => {
    const result = diffResultFrom({
      filePath: '/x/token.ts',
      originalFile: 'const a = 1\n',
      structuredPatch: [patch([' const a = 1', '-const b = 2', '+const b = 3'])],
    })

    expect(result?.hunks[0]?.lines).toEqual([
      { side: 'context', text: 'const a = 1' },
      { side: 'del', text: 'const b = 2' },
      { side: 'add', text: 'const b = 3' },
    ])
    expect(result?.hunks[0]?.newStart).toBe(12)
  })

  it('counts churn as added and removed lines, context excluded', () => {
    const result = diffResultFrom({
      originalFile: 'x',
      structuredPatch: [
        patch([' keep', '-gone', '-gone too', '+new']),
        patch(['+also new'], { newStart: 40 }),
      ],
    })

    expect(result).toMatchObject({ added: 2, removed: 2, change: 'modify' })
  })

  it('takes the host at its word when it declares what it did', () => {
    const created = diffResultFrom({
      type: 'create',
      content: 'one\ntwo\n',
      originalFile: '',
      structuredPatch: [],
    })
    const updated = diffResultFrom({
      type: 'update',
      content: 'one\n',
      originalFile: 'two\n',
      structuredPatch: [patch(['-two', '+one'])],
    })

    expect(created?.change).toBe('create')
    expect(updated?.change).toBe('modify')
  })
})

describe('what a patch says happened to the file', () => {
  // A create reports an EMPTY patch with the content beside it. Rendering nothing would hide a whole
  // new file behind "no diff available" while the bytes sat right there in the record.
  it('renders a created file as one all-added hunk built from its content', () => {
    const result = diffResultFrom({
      type: 'create',
      content: 'one\ntwo\n',
      originalFile: '',
      structuredPatch: [],
    })

    expect(result?.hunks).toEqual([
      {
        oldStart: 0,
        newStart: 1,
        lines: [
          { side: 'add', text: 'one' },
          { side: 'add', text: 'two' },
        ],
      },
    ])
    expect(result?.added).toBe(2)
  })

  it('reads a creation from the patch where the host declared nothing', () => {
    const result = diffResultFrom({
      originalFile: '',
      structuredPatch: [patch(['+first', '+second'], { oldStart: 0, newStart: 1 })],
    })

    expect(result?.change).toBe('create')
  })

  // No CLI Argo reads has a delete tool, so a deletion only ever arrives as a patch that removes
  // every line and keeps none — or as content emptied to nothing.
  it('reads a deletion from a patch that removes every line and adds none', () => {
    const result = diffResultFrom({
      originalFile: 'gone\nalso\n',
      structuredPatch: [patch(['-gone', '-also'], { oldStart: 1, newStart: 0 })],
    })

    expect(result).toMatchObject({ change: 'delete', added: 0, removed: 2 })
  })

  it('reads a deletion where the resulting content is empty', () => {
    const result = diffResultFrom({ originalFile: 'gone\n', content: '', structuredPatch: [] })

    expect(result?.change).toBe('delete')
  })

  // The mutation happened; the patch is just unreadable (a binary file, a shape this cannot parse).
  // Zero hunks is what a row says "no diff available" from — a `null` would drop the row entirely.
  it('reports an unreadable patch as a change with no hunks rather than as no change at all', () => {
    const result = diffResultFrom({ originalFile: 'x', structuredPatch: 'not an array' })

    expect(result).toEqual({
      kind: 'diff',
      tier: 'direct',
      change: 'modify',
      added: 0,
      removed: 0,
      hunks: [],
    })
  })

  it('drops hunk entries it cannot read rather than rendering empty ones', () => {
    const result = diffResultFrom({
      originalFile: 'x',
      structuredPatch: [patch([]), 'nonsense', patch(['+kept'])],
    })

    expect(result?.hunks).toHaveLength(1)
  })

  it('keeps every character of a line carrying no marker at all', () => {
    const result = diffResultFrom({ originalFile: 'x', structuredPatch: [patch(['unmarked'])] })

    expect(result?.hunks[0]?.lines).toEqual([{ side: 'context', text: 'unmarked' }])
  })

  it('is absent for a result carrying no patch — the call was not a mutation', () => {
    expect(diffResultFrom({ stdout: 'ok' })).toBeNull()
    expect(diffResultFrom(null)).toBeNull()
    expect(diffResultFrom('a string result')).toBeNull()
  })
})
