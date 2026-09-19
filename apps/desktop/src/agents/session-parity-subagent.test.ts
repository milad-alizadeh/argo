// The parity suite (#2443) for a Subagent: the same lifecycle read from a Claude and a Codex transcript.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { read } from './session-parity-harnesses'

// What each harness lacks for a Subagent, by name: Codex writes no reply, so its `responded` row
// has no `text`, and neither harness records a duration or a token count in the transcript.
test('a Subagent started, messaged and answered reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'paritySubagent')
  const codex = await read('codex', context, 'paritySubagent')

  const events = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'subagent'
        ? [{ event: row.event, state: row.state ?? null, name: row.name ?? null }]
        : [],
    )
  const expected = [
    { event: 'started', state: null, name: 'Review feed' },
    { event: 'messaged', state: null, name: 'Review feed' },
    { event: 'responded', state: 'completed', name: 'Review feed' },
  ]
  assert.deepEqual(events(claude.feed), expected)
  assert.deepEqual(events(codex.feed), expected)

  const absent = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'subagent' && row.event === 'responded'
        ? [
            {
              text: row.text ?? null,
              durationMs: row.durationMs ?? null,
              tokens: row.tokens ?? null,
            },
          ]
        : [],
    )
  assert.deepEqual(absent(claude.feed), [
    { text: 'Every row draws once.', durationMs: null, tokens: null },
  ])
  assert.deepEqual(absent(codex.feed), [{ text: null, durationMs: null, tokens: null }])

  // The id is the harness's own (a call id, a thread id), so the Roster row is compared without it.
  const subagent = (row: typeof claude.roster) =>
    row.subagents.map(({ label, state, startedAt, endedAt }) => ({
      label,
      state,
      startedAt,
      endedAt,
    }))
  const times = { startedAt: '2026-09-19T10:00:01.000Z', endedAt: '2026-09-19T10:00:03.000Z' }
  const row = { label: 'Review feed', state: 'completed', ...times }
  assert.deepEqual(subagent(claude.roster), [row])
  assert.deepEqual(subagent(codex.roster), [row])
})
