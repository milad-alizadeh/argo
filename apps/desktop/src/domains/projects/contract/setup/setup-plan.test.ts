import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planFixture } from '../../../../test-fixtures/projects/setup/setup-plan.fixture'
import { parseSetupPlanningResult } from './setup-plan'

function first<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) throw new Error('Test fixture unexpectedly has no item.')
  return item
}

function parsePlan(plan: ReturnType<typeof planFixture>) {
  return parseSetupPlanningResult({ status: 'ready-for-review', revision: 'plan-1', plan })
}

test('accepts a well-formed ready-for-review planning result', () => {
  const result = parsePlan(planFixture())
  assert.equal(result.status, 'ready-for-review')
})

test('rejects a plan with duplicate target ids', () => {
  const plan = planFixture()
  assert.throws(
    () => parsePlan({ ...plan, targets: [...plan.targets, first(plan.targets)] }),
    /Duplicate id/,
  )
})

test('rejects a nonempty target list with no default target', () => {
  const plan = planFixture()
  assert.throws(
    () => parsePlan({ ...plan, targets: [{ ...first(plan.targets), isDefault: false }] }),
    /exactly one default target/,
  )
})

test('accepts a zero-target plan with no default target and no verification', () => {
  const result = parsePlan(
    planFixture({ targets: [], capabilities: [], repositoryActions: [], verification: [] }),
  )
  assert.equal(result.status, 'ready-for-review')
})

test('rejects a verification step naming an unknown target', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: {
          ...plan,
          verification: [{ ...first(plan.verification), targetId: 'missing-target' }],
        },
      }),
    /Unknown target id/,
  )
})

test('rejects a self-referencing prerequisite', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parsePlan({
        ...plan,
        repositoryActions: [
          { ...first(plan.repositoryActions), prerequisiteIds: ['action-write-biome'] },
        ],
      }),
    /own prerequisite/,
  )
})

test('rejects a prerequisite cycle', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parsePlan({
        ...plan,
        repositoryActions: [
          { ...first(plan.repositoryActions), prerequisiteIds: ['verify-desktop-test'] },
        ],
      }),
    /Prerequisite cycle/,
  )
})

test('rejects a retained target with no verification step', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: { ...plan, verification: [] },
      }),
    /has no verification step/,
  )
})

test('needs-user-input requires at least one question', () => {
  assert.throws(() =>
    parseSetupPlanningResult({ status: 'needs-user-input', revision: 'plan-1', questions: [] }),
  )
})
