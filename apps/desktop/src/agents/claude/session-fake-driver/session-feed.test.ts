import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '../sessions/chains.ts'
import { projectFeed, UNREADABLE_ROW, unreadableRowHeight } from '../sessions/feed.ts'
import { fixtureFiles } from './session-fixtures'

async function feedOf(names) {
  return projectFeed(stitchChains(await fixtureFiles(names))[0])
}

test('draws one row per content block, not one row per record', async () => {
  const rows = await feedOf(['externalBasic'])
  assert.deepEqual(
    rows.map((row) => `${row.shape}:${row.role ?? ''}`),
    ['unreadable:', 'prose:user', 'thought:', 'prose:assistant'],
  )
  assert.equal(rows[1].text, 'Refactor the auth module')
  assert.equal(rows[2].text, 'considering')
})

test('draws an interrupt and a compaction as markers in the order they happened', async () => {
  const rows = await feedOf(['marks'])
  assert.deepEqual(
    rows.map((row) => (row.shape === 'marker' ? `marker:${row.marker}` : row.shape)),
    ['prose', 'prose', 'marker:interrupted', 'marker:compacted', 'prose'],
  )
  assert.equal(rows[3].id, 'm-c:compacted')
})

test('gives every row an id that is stable and unique', async () => {
  const rows = await feedOf(['externalBasic'])
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
  assert.equal(rows[2].id, 'u-asst-1:0')
  assert.equal(rows[3].id, 'u-asst-1:1')
})

test('reads a whole Session in the order the work happened', async () => {
  const rows = await feedOf(['resumeChild', 'resumeParent'])
  assert.deepEqual(
    rows.filter((row) => row.shape === 'prose').map((row) => row.text),
    ['Start the parent work', 'Parent reply', 'Continue the work', 'Continuing'],
  )
})

// A damaged file must read as damaged rather than as a short Session. A run of damaged lines is
// one break in the history, so five of them in a row are one row.
test('draws a break where it could not read the transcript, once per run', async () => {
  const rows = await feedOf(['unparseableBody'])
  assert.equal(rows.length, 1)
  assert.deepEqual([...new Set(rows.map((row) => row.shape))], ['unreadable'])
})

// ADR-0033 rule 1: the one row shape Blink does not lay out from content states its own height,
// and the packaged proof asserts this arithmetic equals the drawn box.
test('states the unreadable row height as arithmetic', () => {
  assert.equal(unreadableRowHeight(), UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.itemHeight)
  assert.equal(unreadableRowHeight(), 44)
})

// The CLI nests a subagent's turn inside the Session's; Argo leaves it out rather than drawing
// another agent's work as the reader's own.
test('leaves a subagent turn out of the Session history', async () => {
  const rows = await feedOf(['subagentTail'])
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'source'],
  )
  assert.equal(
    rows.some((row) => row.text === 'Eleven callers, all in the same package.'),
    false,
  )
})
