import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import { UNREADABLE_ROW, unreadableRowHeight } from '@/domains/sessions/main/projection/feed/feed'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { fixtureFiles } from './session-fixtures'

async function feedOf(names) {
  return projectFeed(stitchChains(await fixtureFiles(names))[0], undefined).rows
}

function rowText(row) {
  if (row.shape === 'event') return `${row.event}:${row.text}`
  if (row.shape === 'prose') return row.text
  return row.shape
}

test('draws one row per content block, not one row per record', async () => {
  const rows = await feedOf(['11111111-2222-4333-8444-555555555555'])
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

test('draws a standalone local command once at its prompt boundary', async () => {
  const rows = await feedOf(['standaloneCommand'])
  assert.deepEqual(rows.map(rowText), [
    'Prepare the work.',
    'Ready.',
    'skill-invocation:/implement 2389',
    'Implemented.',
  ])
})

test('gives every row an id that is stable and unique', async () => {
  const rows = await feedOf(['11111111-2222-4333-8444-555555555555'])
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

// The Harness nests a subagent's turn inside the Session's; Argo draws the Subagent as event rows
// rather than drawing another agent's work as the reader's own.
test('leaves a subagent turn out of the Session history', async () => {
  const rows = await feedOf(['subagentTail'])
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'subagent'],
  )
  assert.equal(
    rows.some((row) => row.text === 'Eleven callers, all in the same package.'),
    false,
  )
})

test('merges consecutive tool runs with nothing rendered between them', async () => {
  const rows = await feedOf(['commandRuns'])
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'tool-group'],
  )
  const [group] = rows.filter(
    (row): row is Extract<(typeof rows)[number], { shape: 'tool-group' }> =>
      row.shape === 'tool-group',
  )
  assert.deepEqual(
    { label: group?.label, calls: group?.calls.map(({ text }) => text) },
    { label: 'Ran 3 commands', calls: ['bun test', 'bun run typecheck', 'bunx biome check .'] },
  )
})

// Claude Code writes each thinking block as its own record, and a redacted one has no text.
test('merges tool runs separated only by thinking with no text', async () => {
  const rows = await feedOf(['thinkingCommandRuns'])
  assert.deepEqual(
    rows.map((row) => (row.shape === 'tool-group' ? row.label : row.shape)),
    ['prose', 'Ran 2 commands'],
  )
})
