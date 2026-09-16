import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionRosterReconciliation } from './managed-row'
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
