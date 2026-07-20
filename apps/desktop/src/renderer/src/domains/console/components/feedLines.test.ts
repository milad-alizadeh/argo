import { describe, expect, it } from 'vitest'
import { feedLines } from './feedLines'

describe('feedLines', () => {
  it('lifts the marker off a marked line', () => {
    expect(feedLines('▸ Bash: bunx vitest run')).toEqual([
      { marker: true, text: 'Bash: bunx vitest run' },
    ])
  })

  it('leaves an unmarked line whole', () => {
    expect(feedLines('  ✓ rotation.test.ts (7)')).toEqual([
      { marker: false, text: '  ✓ rotation.test.ts (7)' },
    ])
  })

  it('keeps blank lines so the feed keeps its own spacing', () => {
    expect(feedLines('▸ run\n\n done')).toEqual([
      { marker: true, text: 'run' },
      { marker: false, text: '' },
      { marker: false, text: ' done' },
    ])
  })

  it('treats a bare marker with no space after it as text', () => {
    expect(feedLines('▸run')).toEqual([{ marker: false, text: '▸run' }])
  })

  it('only lifts a marker that opens the line', () => {
    expect(feedLines('done ▸ next')).toEqual([{ marker: false, text: 'done ▸ next' }])
  })

  it('renders an empty feed as one empty line rather than nothing', () => {
    expect(feedLines('')).toEqual([{ marker: false, text: '' }])
  })
})
