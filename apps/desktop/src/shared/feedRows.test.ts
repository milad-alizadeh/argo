import { describe, expect, it } from 'vitest'
import { anAgent, aTurn, said, thought } from './__fixtures__/tree'
import { feedRows } from './feedRows'

describe('feedRows', () => {
  it('opens each turn with its prompt and follows it with the prose in emission order', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prompt: 'wire the observer',
          prose: [thought('weigh it'), said('done')],
        }),
      ]),
    )

    expect(rows).toEqual([
      { kind: 'prompt', key: 'prompt:t1', text: 'wire the observer', turnId: 't1' },
      { kind: 'thought', key: 'prose:t1:0', markdown: 'weigh it', collapsed: true },
      { kind: 'message', key: 'prose:t1:1', markdown: 'done' },
    ])
  })

  // The order the whole feed is read in, and now the order the nav list beside it runs in too: prose
  // only reads downward, so the live turn is the one at the bottom.
  it('runs chronologically, oldest turn first', () => {
    const rows = feedRows(
      anAgent([
        aTurn({ id: 'first', prompt: 'one' }),
        aTurn({ id: 'second', prompt: 'two' }),
        aTurn({ id: 'third', prompt: 'three', stopReason: null }),
      ]),
    )

    expect(rows.map((row) => row.kind === 'prompt' && row.text)).toEqual(['one', 'two', 'three'])
  })

  it('gives a turn with no assistant prose its prompt row and nothing else', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', prompt: 'still thinking' })]))

    expect(rows).toEqual([
      { kind: 'prompt', key: 'prompt:t1', text: 'still thinking', turnId: 't1' },
    ])
  })

  // An absent prompt is an absent fact (a chain resumed mid-turn), so the turn opens on its prose
  // rather than on a fabricated row saying the user asked for nothing.
  it('opens a turn whose record carried no prompt with no prompt row at all', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', prose: [said('resumed')] })]))

    expect(rows).toEqual([{ kind: 'message', key: 'prose:t1:0', markdown: 'resumed' }])
  })

  it('never reads a thought as a message, and marks every thought collapsed', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', prose: [thought('a'), thought('b')] })]))

    expect(rows.every((row) => row.kind === 'thought' && row.collapsed)).toBe(true)
  })

  it('keeps prose verbatim, whitespace and markup alike', () => {
    const raw = '  first\n\n    <b>not html</b>  '
    const [row] = feedRows(anAgent([aTurn({ id: 't1', prose: [said(raw)] })]))

    expect(row?.kind === 'message' && row.markdown).toBe(raw)
  })

  it('yields no rows for an agent that has done nothing yet', () => {
    expect(feedRows(anAgent([]))).toEqual([])
  })

  it('keys every row uniquely across turns, so a long feed has no colliding anchors', () => {
    const rows = feedRows(
      anAgent([
        aTurn({ id: 't1', prompt: 'p', prose: [said('a')] }),
        aTurn({ id: 't2', prompt: 'p', prose: [said('a')] }),
      ]),
    )

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })
})
