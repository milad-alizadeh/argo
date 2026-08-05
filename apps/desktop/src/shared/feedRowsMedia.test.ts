import { describe, expect, it } from 'vitest'
import { aCall, aMedia, anAgent, anEdit, aShot, aTurn, said } from './__fixtures__/tree'
import { feedRows } from './feedRows'
import type { ToolCall } from './runtimeTree'

// The MEDIA rows of the feed: what an image the agent looked at reads as, and what happens where
// there are no pixels to show. Split from the mutation and folding suites for the line ceiling.

const rowsOf = (calls: ToolCall[], prose = [said('looked')]): ReturnType<typeof feedRows> =>
  feedRows(anAgent([aTurn({ id: 't1', prose, toolCalls: calls })]))

const MEDIA: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a read that came back with pixels is a media row, not a folded read',
    aShot({ id: 'm1' }),
    { kind: 'media', key: 'media:m1', subject: 'tmp/shot.png', status: 'completed' },
  ],
  // The tier is the whole fact: these bytes are the ones the agent was sent.
  [
    'an embedded image carries the record’s own bytes at the direct tier',
    aShot({ id: 'm2' }),
    { kind: 'media', media: { tier: 'direct', mediaType: 'image/png' } },
  ],
  [
    'a disk-sourced image keeps the lower tier the row labels it by',
    aShot({ id: 'm3', result: aMedia({ tier: 'derived' }) }),
    { kind: 'media', media: { tier: 'derived' } },
  ],
  // A missing, deleted or undecodable file is still a row: the agent DID look at a picture, and a
  // row saying it can no longer be shown is honest where a folded read line is merely silent.
  [
    'an image with no bytes is a row with none, never a missing row',
    aShot({ id: 'm4', result: aMedia({ bytes: null }) }),
    { kind: 'media', media: { bytes: null } },
  ],
  // A failure that still returned an image returned the thing worth looking at.
  [
    'a failed call that still returned pixels shows them',
    aShot({ id: 'm6', status: 'failed' }),
    { kind: 'media', status: 'failed', media: { tier: 'direct' } },
  ],
  // The kind is not the fact; the picture is. An MCP browser tool lands on `other`.
  [
    'pixels from a tool of any other kind read the same',
    aShot({ id: 'm7', name: 'mcp__chrome__computer', kind: 'other', target: null }),
    { kind: 'media', subject: null },
  ],
]

describe('a media row', () => {
  it.each(MEDIA)('%s', (_name, call, expected) => {
    const [row] = rowsOf([call])

    expect(row).toMatchObject(expected)
  })

  // The correctness requirement of the whole feature: agents re-render the same screenshot path
  // several times within one turn, and three reads of one filename are three different pictures.
  it('renders three reads of one path as three independent images', () => {
    const rows = rowsOf([
      aShot({ id: 'a', result: aMedia({ bytes: 'first' }) }),
      aShot({ id: 'b', result: aMedia({ bytes: 'second' }) }),
      aShot({ id: 'c', result: aMedia({ bytes: 'third' }) }),
    ])

    expect(rows.filter((row) => row.kind === 'media').map((row) => row.media.bytes)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  // Loud by construction: a screenshot folded into `read 4` is a debugging loop you have to leave
  // the surface to follow, and the run either side of it must break rather than absorb it.
  it('breaks a quiet fold and never folds into one', () => {
    const rows = rowsOf([
      aCall({ id: 'r1' }),
      aShot({ id: 'shot' }),
      aCall({ id: 'r2' }),
      aCall({ id: 'r3' }),
    ])

    expect(rows.map((row) => row.kind)).toEqual(['quiet', 'media', 'quiet', 'message'])
  })

  it('renders no media row for a call that produced no image', () => {
    const rows = rowsOf([aCall({ id: 'r' }), anEdit({ id: 'e' })])

    expect(rows.some((row) => row.kind === 'media')).toBe(false)
  })

  // A row exists because a RESULT came back carrying pixels. Until one does, nothing about the call
  // says it will produce a picture, so there is no running media row to render — a shot being taken is
  // a read like any other and waits in the fold. A row promising an image before one exists would be
  // a fabricated fact about a call that may yet fail.
  it('leaves a shot still being taken in the quiet fold', () => {
    const rows = rowsOf([aShot({ id: 'live', status: 'in_progress', result: null })])

    expect(rows.map((row) => row.kind)).toEqual(['quiet', 'message'])
  })
})

// There is no decode bound any more, and no `open` on the row to carry one. It existed so a turn of
// thirty screenshots would not hold thirty decoded bitmaps, and it kept the four most recent shown.
// Closed-by-default at the COMPONENT does the same job better — a closed row mounts no `<img>` at
// all, so the cap is zero rather than four — and it does it without the derivation deciding, per
// row, how much of the surface a reader is allowed to see.
//
// What remains here is the claim that survived: every shot gets its OWN row, however many there are.
describe('a turn that took many screenshots', () => {
  const shots = (count: number): ToolCall[] =>
    Array.from({ length: count }, (_unused, index) => aShot({ id: `s${index}` }))

  it('gives every shot its own row rather than folding the older ones away', () => {
    const rows = rowsOf(shots(7)).filter((row) => row.kind === 'media')

    expect(rows).toHaveLength(7)
  })

  it('keeps each row keyed to its own call, so three reads of one path stay three pictures', () => {
    const keys = rowsOf(shots(3))
      .filter((row) => row.kind === 'media')
      .map((row) => row.key)

    expect(new Set(keys).size).toBe(3)
  })

  // Shots either side of a paragraph stay either side of it: the row is placed by where the call was
  // made in the narrative, and nothing about media overrides that.
  it('leaves shots in the narrative positions their calls were made at', () => {
    const spread = Array.from({ length: 6 }, (_unused, index) =>
      aShot({ id: `s${index}`, proseIndex: index % 2 }),
    )

    const kinds = rowsOf(spread, [said('one'), said('two')]).map((row) => row.kind)

    expect(kinds.filter((kind) => kind === 'media')).toHaveLength(6)
    expect(kinds.indexOf('message')).toBeGreaterThan(0)
  })
})
