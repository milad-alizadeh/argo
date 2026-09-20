import { expect, test } from 'bun:test'
import { i18n } from '@/renderer/i18n'
import { type DelegationPhase, delegationFacts } from '../../feed/delegation/delegation-facts'
import { delegationEntries } from './session-work-entries'
import { workPresentation } from './work-presentation'

const t = i18n.getFixedT('en', 'sessions')

test('gives a completed Subagent and Shell their reader text', () => {
  expect(
    workPresentation(
      {
        kind: 'subagent',
        name: 'review_feed',
        state: 'done',
        model: 'gpt-6',
        durationMs: 12_000,
        tokens: 2_700,
      },
      t,
    ),
  ).toEqual({ title: 'Review feed', state: 'Done', facts: 'gpt-6 · 12s · 2.7k tokens' })

  expect(
    workPresentation(
      {
        kind: 'shell',
        id: 'quality',
        command: 'bun run quality',
        label: null,
        state: 'completed',
        startedAt: '2026-09-20T10:00:00.000Z',
        endedAt: '2026-09-20T10:00:12.000Z',
        result: 'Quality passed.',
        now: Date.parse('2026-09-20T10:00:12.000Z'),
      },
      t,
    ),
  ).toEqual({
    title: 'bun run quality',
    state: 'Completed',
    facts: '12s · Quality passed.',
  })
})

test('keeps each failed or interrupted end state distinct', () => {
  const input = {
    kind: 'shell' as const,
    id: 'watch',
    command: null,
    label: null,
    startedAt: null,
    endedAt: null,
    result: null,
    now: 0,
  }

  expect(workPresentation({ ...input, state: 'failed' }, t).state).toBe('Failed')
  expect(workPresentation({ ...input, state: 'interrupted' }, t).state).toBe('Interrupted')
})

test.each([
  ['running', 'running'],
  ['completed', 'succeeded'],
  ['failed', 'failed'],
  ['interrupted', 'interrupted'],
] as const)('gives the Feed row and Roster entry the same Subagent text for %s', (state, phase) => {
  const feed = delegationFacts(
    {
      id: 'review-feed-call',
      name: 'review_feed',
      phase: phase satisfies DelegationPhase,
      line: null,
      durationMs: 12_000,
      tokens: 2_700,
      model: 'gpt-6',
    },
    t,
  )
  const [roster] = delegationEntries(
    [
      {
        id: 'review-feed-call',
        label: 'review_feed',
        state,
        startedAt: '2026-09-20T10:00:00.000Z',
        endedAt: state === 'running' ? null : '2026-09-20T10:00:12.000Z',
      },
    ],
    {
      now: Date.parse('2026-09-20T10:00:12.000Z'),
      usage: { 'review-feed-call': { model: 'gpt-6', tokens: 2_700 } },
    },
    t,
  )

  expect({
    title: feed.title,
    state: feed.state,
    facts: feed.facts,
  }).toEqual({
    title: roster?.title,
    state: roster?.state,
    facts: roster?.facts,
  })
})
