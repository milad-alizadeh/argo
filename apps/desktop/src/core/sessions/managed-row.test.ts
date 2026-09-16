import assert from 'node:assert/strict'
import { test } from 'node:test'
import { managedRow, mergeManagedRoster } from './managed-row'
import type { SessionRosterRow, SessionStatus, SessionTitle } from './models'
import { reconcileRosterRow, rosterRowFields } from './roster-row-definition'

const setup = { model: null, effort: null, mode: null } as const
const HELD_TITLE = 'Held title'
const OBSERVED_TITLE = 'Observed title'

function row(id: string, status: SessionStatus): SessionRosterRow {
  return managedRow(id, {
    cli: 'claude',
    compactionPercentage: null,
    compactionStartedAt: null,
    compactionTokens: null,
    cwd: '/projects/argo',
    status,
    setup,
    prompt: 'Do the thing.',
    startedAt: '2026-09-14T00:00:00.000Z',
  })
}

function mergedTitle(observedTitle: SessionTitle | null, heldTitle: SessionTitle | null) {
  const held = { ...row('s1', 'running'), title: heldTitle }
  const observed = { ...row('s1', 'running'), title: observedTitle }
  const merged = mergeManagedRoster(
    { rows: [observed], filesFound: 1, filesRead: 1, filesUnreadable: 0, nextCursor: null },
    [held],
  )
  return merged.rows[0]?.title
}

function mergedStatus(discoveredStatus: SessionStatus, heldStatus: SessionStatus) {
  const merged = mergeManagedRoster(
    {
      rows: [row('s1', discoveredStatus)],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      nextCursor: null,
    },
    [row('s1', heldStatus)],
  )
  return merged.rows[0]?.status
}

test('reconciles every Roster field by its declared rule', () => {
  const held = managedRow('session-1', {
    cli: 'claude',
    compactionPercentage: 40,
    compactionStartedAt: '2026-09-14T09:00:00.000Z',
    compactionTokens: '4,000',
    cwd: '/held',
    prompt: 'held prompt',
    setup: { model: 'held-model', effort: 'held-effort', mode: 'held-mode' },
    startedAt: '2026-09-14T09:00:00.000Z',
    status: 'running',
    title: { text: 'Held title', source: 'custom' },
  })
  const observed = {
    ...held,
    posture: 'external',
    title: { text: 'Observed title', source: 'summarised' },
    status: 'idle',
    cwd: '/observed',
    branch: 'main',
    updatedAt: '2026-09-14T09:05:00.000Z',
    compactionStartedAt: null,
    compactionPercentage: null,
    compactionTokens: null,
    setup: { model: 'observed-model', effort: 'observed-effort', mode: 'observed-mode' },
  } as const
  const reconciled = reconcileRosterRow(observed, held, () => held.title)
  const rows = {
    held,
    observed,
    'stronger-title': { ...observed, title: held.title },
  }

  for (const field of rosterRowFields) {
    assert.deepEqual(reconciled[field.name], rows[field.reconciliation][field.name], field.name)
  }
})

test('a managed Session shows the strongest title known for it, keeping its own on a tie', () => {
  const cases = [
    { observed: 'summarised', held: 'first-prompt', wins: OBSERVED_TITLE },
    { observed: 'custom', held: 'first-prompt', wins: OBSERVED_TITLE },
    { observed: 'custom', held: 'summarised', wins: OBSERVED_TITLE },
    { observed: 'summarised', held: 'custom', wins: HELD_TITLE },
    { observed: 'first-prompt', held: 'custom', wins: HELD_TITLE },
    { observed: 'summarised', held: 'summarised', wins: HELD_TITLE },
  ] as const

  for (const { observed, held, wins } of cases) {
    const merged = mergedTitle(
      { text: OBSERVED_TITLE, source: observed },
      { text: HELD_TITLE, source: held },
    )
    assert.equal(merged?.text, wins, `observed ${observed} against held ${held}`)
  }
})

test('a managed Session shows whichever title exists when the other is missing', () => {
  const found = { text: OBSERVED_TITLE, source: 'summarised' } as const
  const held = { text: HELD_TITLE, source: 'first-prompt' } as const

  assert.deepEqual(mergedTitle(null, held), held)
  assert.deepEqual(mergedTitle(found, null), found)
})

test('the held permission status always wins over the discovered floor', () => {
  assert.equal(mergedStatus('idle', 'permission'), 'permission')
  assert.equal(mergedStatus('unknown', 'permission'), 'permission')
})

test('the held status wins only where the discovered floor has nothing to say', () => {
  assert.equal(mergedStatus('unknown', 'running'), 'running')
})

test('a definite discovered floor is never overridden by a held `running`', () => {
  assert.equal(mergedStatus('idle', 'running'), 'idle')
  assert.equal(mergedStatus('asking', 'running'), 'asking')
  assert.equal(mergedStatus('stopped', 'running'), 'stopped')
})

test('a Session with no held counterpart passes through the discovered row untouched', () => {
  const merged = mergeManagedRoster(
    {
      rows: [row('only-discovered', 'idle')],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      nextCursor: null,
    },
    [],
  )
  assert.equal(merged.rows[0]?.status, 'idle')
})
