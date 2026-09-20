// The parity suite (#2443) for a Subagent: the same lifecycle read from a Claude and a Codex transcript.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { delegationEntries } from '@/domains/sessions/renderer/components/work/session-work-entries'
import { delegationFacts } from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import { i18n } from '@/platform/renderer/i18n/config'
import { read } from './session-parity-harnesses'

const t = i18n.getFixedT('en', 'sessions')

function respondedPresentation(result: Awaited<ReturnType<typeof read>>) {
  const feedRow = result.feed.find((row) => row.shape === 'subagent' && row.event === 'responded')
  assert.ok(feedRow?.shape === 'subagent', 'the transcript has a responded Subagent row')
  assert.ok(feedRow.state !== undefined, 'the responded Subagent row names its end state')
  const rosterEntry = delegationEntries(result.roster.subagents, { now: 0, usage: {} }, t).find(
    (entry) => entry.id === feedRow.subagentId,
  )
  assert.ok(rosterEntry !== undefined, 'the Roster has the same Subagent')
  let phase: 'succeeded' | 'interrupted' | 'failed'
  switch (feedRow.state) {
    case 'completed':
      phase = 'succeeded'
      break
    case 'interrupted':
      phase = 'interrupted'
      break
    case 'failed':
      phase = 'failed'
      break
  }
  const feed = delegationFacts(
    {
      id: feedRow.id,
      name: feedRow.name ?? feedRow.subagentId,
      phase,
      line: feedRow.text ?? null,
      durationMs: feedRow.durationMs ?? null,
      tokens: feedRow.tokens ?? null,
      model: feedRow.model ?? null,
    },
    t,
  )
  const text = ({ title, state, facts }: { title: string; state: string; facts: string }) => ({
    title,
    state,
    facts,
  })
  return { feed: text(feed), roster: text(rosterEntry) }
}

// What each harness lacks for a Subagent, by name: Codex writes no reply, and neither harness
// records a token count in the parent transcript. Duration comes from the lifecycle timestamps.
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
    { text: 'Every row draws once.', durationMs: 2000, tokens: null },
  ])
  assert.deepEqual(absent(codex.feed), [{ text: null, durationMs: 2000, tokens: null }])

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

test('the Feed row and Roster entry share Subagent presentation text for each end state', async (context) => {
  const cases = [
    { harness: 'claude', session: 'paritySubagent', text: 'Done' },
    { harness: 'codex', session: 'paritySubagent', text: 'Done' },
    { harness: 'claude', session: 'paritySubagentFailed', text: 'Failed' },
    { harness: 'claude', session: 'paritySubagentInterrupted', text: 'Interrupted' },
  ] as const
  for (const { harness, session, text } of cases) {
    const presentation = respondedPresentation(await read(harness, context, session))
    assert.deepEqual(presentation.feed, presentation.roster)
    assert.equal(presentation.feed.state, text)
  }
})
