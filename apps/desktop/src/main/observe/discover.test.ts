import { describe, expect, it } from 'vitest'
import { selectWorkingSet, WORKING_SET_WINDOW_MS } from './discover'

const NOW = Date.parse('2026-07-20T12:00:00.000Z')

describe('selectWorkingSet', () => {
  it('keeps files touched inside the window and drops stale history', () => {
    const files = [
      { path: 'fresh.jsonl', mtimeMs: NOW - 60_000 },
      { path: 'edge.jsonl', mtimeMs: NOW - WORKING_SET_WINDOW_MS },
      { path: 'stale.jsonl', mtimeMs: NOW - WORKING_SET_WINDOW_MS - 1 },
    ]

    expect(selectWorkingSet(files, NOW)).toEqual(['fresh.jsonl', 'edge.jsonl'])
  })

  it('returns nothing for an empty listing', () => {
    expect(selectWorkingSet([], NOW)).toEqual([])
  })
})
