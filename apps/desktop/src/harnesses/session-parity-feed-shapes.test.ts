// The parity suite (#2505) for every Feed row shape session-parity.test.ts, -ask and -subagent
// leave out: tool-group, prose, thought, event, marker, source, image and unreadable. Each case
// draws the same shared scenario from a Claude and a Codex transcript, or names why it can't.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { read } from './session-parity-harnesses'

test('tool calls of different kinds fold into one Tool group with a shared label', async (context) => {
  const claude = await read('claude', context, 'parityToolGroup')
  const codex = await read('codex', context, 'parityToolGroup')
  const groups = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'tool-group' ? [{ label: row.label, count: row.calls.length }] : [],
    )
  const expected = [{ label: 'Ran a command, edited a file, read a file', count: 3 }]
  assert.deepEqual(groups(claude.feed), expected)
  assert.deepEqual(groups(codex.feed), expected)
})

test('a prompt and a reply read as prose the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityProse')
  const codex = await read('codex', context, 'parityProse')
  const prose = (feed: typeof claude.feed) =>
    feed.flatMap((row) => (row.shape === 'prose' ? [{ role: row.role, text: row.text }] : []))
  const expected = [
    { role: 'user', text: 'Say hello, then confirm.' },
    { role: 'assistant', text: 'Hello there. Confirmed.' },
  ]
  assert.deepEqual(prose(claude.feed), expected)
  assert.deepEqual(prose(codex.feed), expected)
})

// Claude writes a thought as its own thinking block; Codex folds a reasoning item's summary
// chunks into one. Both draw the same plain-text thought once the harness's own markup comes off.
test('a reasoning thought reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityThought')
  const codex = await read('codex', context, 'parityThought')
  const thoughts = (feed: typeof claude.feed) =>
    feed.flatMap((row) => (row.shape === 'thought' ? [row.text] : []))
  assert.deepEqual(thoughts(claude.feed), ['Revising session lifecycle handling'])
  assert.deepEqual(thoughts(codex.feed), ['Revising session lifecycle handling'])
})

// A background task's status line: Claude's own tagged notification and Codex's `<status>`
// envelope both draw an `event` row of the same kind and text. Claude discards the envelope's raw
// text for a harness-level notice; Codex keeps it for diagnostics, so `raw` is not compared here.
test('a harness status update reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityEvent')
  const codex = await read('codex', context, 'parityEvent')
  const events = (feed: typeof claude.feed) =>
    feed.flatMap((row) => (row.shape === 'event' ? [{ event: row.event, text: row.text }] : []))
  const expected = [{ event: 'status', text: 'Build completed' }]
  assert.deepEqual(events(claude.feed), expected)
  assert.deepEqual(events(codex.feed), expected)
})

// The two marker values a Feed draws, from each harness's own signal: Claude's compact boundary
// record and interrupted-request text; Codex's `compacted` record and `turn_aborted` event.
test('a compaction and an interrupted turn draw the same marker for Claude and for Codex', async (context) => {
  const markers = (feed: Awaited<ReturnType<typeof read>>['feed']) =>
    feed.flatMap((row) => (row.shape === 'marker' ? [row.marker] : []))
  const cases = [
    { session: 'parityMarkerCompacted', marker: 'compacted' },
    { session: 'parityMarkerInterrupted', marker: 'interrupted' },
  ] as const
  for (const { session, marker } of cases) {
    const claude = await read('claude', context, session)
    const codex = await read('codex', context, session)
    assert.deepEqual(markers(claude.feed), [marker])
    assert.deepEqual(markers(codex.feed), [marker])
  }
})

// Neither harness names every content type it can send: an unfamiliar assistant block becomes a
// `source` row on both, holding the type name and the raw block instead of dropping it. The label
// is each harness's own foreign type name, so it is read but never compared across the two.
test('an unfamiliar assistant block draws a source row instead of being dropped', async (context) => {
  const claude = await read('claude', context, 'paritySource')
  const codex = await read('codex', context, 'paritySource')
  const sources = (feed: typeof claude.feed) =>
    feed.flatMap((row) => (row.shape === 'source' ? [row] : []))
  const [claudeRow] = sources(claude.feed)
  const [codexRow] = sources(codex.feed)
  assert.equal(claudeRow?.label, 'redacted_thinking')
  assert.ok(claudeRow?.source.includes('opaque-bytes'))
  assert.equal(codexRow?.label, 'refusal')
  assert.ok(codexRow?.source.includes("can't help with that"))
})

test('an assistant image reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityImage')
  const codex = await read('codex', context, 'parityImage')
  const images = (feed: typeof claude.feed) =>
    feed.flatMap((row) => (row.shape === 'image' ? [{ role: row.role, source: row.source }] : []))
  const expected = [{ role: 'assistant', source: 'data:image/png;base64,iVBORw0KGgo=' }]
  assert.deepEqual(images(claude.feed), expected)
  assert.deepEqual(images(codex.feed), expected)
})

test('a broken transcript line draws an unreadable row without losing the messages around it', async (context) => {
  const claude = await read('claude', context, 'parityUnreadable')
  const codex = await read('codex', context, 'parityUnreadable')
  const shapes = (feed: typeof claude.feed) => feed.map((row) => row.shape)
  const expected = ['prose', 'unreadable', 'prose']
  assert.deepEqual(shapes(claude.feed), expected)
  assert.deepEqual(shapes(codex.feed), expected)
})

// Codex's slash commands run client-side and write no echo of their own output into the
// transcript, so `command-output` is a Claude-only row: only the CLI's own `/effort` reply is
// ever read back this way.
test('a slash command echoes its stdout as a command-output row, a Claude-only shape', async (context) => {
  const claude = await read('claude', context, 'parityCommandOutput')
  const outputs = claude.feed.flatMap((row) => (row.shape === 'command-output' ? [row.text] : []))
  assert.deepEqual(outputs, ['Set effort level to medium'])
})
