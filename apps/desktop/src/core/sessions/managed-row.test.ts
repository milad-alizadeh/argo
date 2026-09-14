import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptDiscovery } from './discover-transcript-sessions'
import { managedRow, mergeManagedRoster, sessionRosterReconciliation } from './managed-row'
import { type SessionRosterRow, type SessionStatus, sessionRosterRowSchema } from './models'

type ReconciliationRule =
  (typeof sessionRosterReconciliation)[keyof typeof sessionRosterReconciliation]

const setup = { model: null, effort: null, mode: null } as const

function assertSessionRosterReconciliationIsTotal(
  schema: { shape: Record<string, unknown> },
  reconciliation: Partial<Record<string, ReconciliationRule>>,
): void {
  for (const field of Object.keys(schema.shape)) {
    if (reconciliation[field] === undefined) {
      throw new Error(`SessionRosterRow reconciliation is missing a rule for "${field}".`)
    }
  }

  for (const field of Object.keys(reconciliation)) {
    if (schema.shape[field] === undefined) {
      throw new Error(`SessionRosterRow reconciliation has no field named "${field}".`)
    }
  }
}

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

function mergedStatus(discoveredStatus: SessionStatus, heldStatus: SessionStatus) {
  const merged = mergeManagedRoster(
    { rows: [row('s1', discoveredStatus)], filesFound: 1, filesRead: 1, filesUnreadable: 0 },
    [row('s1', heldStatus)],
  )
  return merged.rows[0]?.status
}

test('states a reconciliation rule for every SessionRosterRow field', () => {
  assert.doesNotThrow(() =>
    assertSessionRosterReconciliationIsTotal(sessionRosterRowSchema, sessionRosterReconciliation),
  )
})

test('names the SessionRosterRow field whose reconciliation rule is missing', () => {
  const withoutTitle = Object.fromEntries(
    Object.entries(sessionRosterReconciliation).filter(([field]) => field !== 'title'),
  )

  assert.throws(
    () => assertSessionRosterReconciliationIsTotal(sessionRosterRowSchema, withoutTitle),
    /SessionRosterRow reconciliation is missing a rule for "title"/,
  )
})

test('names a reconciliation rule that no longer matches a SessionRosterRow field', () => {
  assert.throws(
    () =>
      assertSessionRosterReconciliationIsTotal(sessionRosterRowSchema, {
        ...sessionRosterReconciliation,
        departedField: 'observed',
      }),
    /SessionRosterRow reconciliation has no field named "departedField"/,
  )
})

test('keeps the current held fields when reconciling a managed row', () => {
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
  const discovered: TranscriptDiscovery = {
    rows: [observed],
    filesFound: 1,
    filesRead: 1,
    filesUnreadable: 0,
  }

  const [merged] = mergeManagedRoster(discovered, [held]).rows

  assert.deepEqual(merged, {
    ...observed,
    posture: held.posture,
    title: held.title,
    locked: undefined,
    compactionStartedAt: held.compactionStartedAt,
    compactionPercentage: held.compactionPercentage,
    compactionTokens: held.compactionTokens,
  })
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
    { rows: [row('only-discovered', 'idle')], filesFound: 1, filesRead: 1, filesUnreadable: 0 },
    [],
  )
  assert.equal(merged.rows[0]?.status, 'idle')
})
