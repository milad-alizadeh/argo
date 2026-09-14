import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptDiscovery } from './discover-transcript-sessions'
import { managedRow, mergeManagedRoster, sessionRosterReconciliation } from './managed-row'
import { sessionRosterRowSchema } from './models'

type ReconciliationRule =
  (typeof sessionRosterReconciliation)[keyof typeof sessionRosterReconciliation]

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

  const [row] = mergeManagedRoster(discovered, [held]).rows

  assert.deepEqual(row, {
    ...observed,
    posture: held.posture,
    title: held.title,
    compactionStartedAt: held.compactionStartedAt,
    compactionPercentage: held.compactionPercentage,
    compactionTokens: held.compactionTokens,
  })
})
