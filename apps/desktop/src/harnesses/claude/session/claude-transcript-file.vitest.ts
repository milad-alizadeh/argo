import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { chainFromLines, parseTranscriptLines } from './claude-transcript-file'

function fixtureLines(name: string) {
  const text = readFileSync(
    new URL(`../../../../mocks/cli/claude/fixtures/sessions/${name}.jsonl`, import.meta.url),
    'utf8',
  )
  return parseTranscriptLines(text)
}

test('crosses two compaction boundaries to reach the first prompt', () => {
  const chain = chainFromLines(fixtureLines('parityMarkerCompacted'))

  expect(chain.map((entry) => entry.uuid)).toEqual([
    'mc-p1',
    'mc-a1',
    'mc-c1',
    'mc-p2',
    'mc-a2',
    'mc-c2',
    'mc-p3',
    'mc-a3',
  ])
})

test('stops at the last entry whose parent is unresolvable, without erroring', () => {
  const chain = chainFromLines([
    { type: 'user', uuid: 'u1', parentUuid: 'missing-ancestor' },
    { type: 'assistant', uuid: 'a1', parentUuid: 'u1' },
  ])

  expect(chain.map((entry) => entry.uuid)).toEqual(['u1', 'a1'])
})

test('drops a sidechain entry from the main chain', () => {
  const chain = chainFromLines([
    { type: 'user', uuid: 'u1', parentUuid: null },
    { type: 'user', uuid: 'side-1', parentUuid: 'u1', isSidechain: true },
    { type: 'assistant', uuid: 'a1', parentUuid: 'u1' },
  ])

  expect(chain.map((entry) => entry.uuid)).toEqual(['u1', 'a1'])
})
