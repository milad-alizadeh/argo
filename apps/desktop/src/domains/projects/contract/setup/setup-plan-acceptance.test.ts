import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  acceptedPlanFixture,
  planFixture,
} from '../../../../test-fixtures/projects/setup/setup-plan.fixture'
import { validateAcceptedSetupPlan } from './setup-plan'
import { validatePlanRevision } from './setup-plan-validation'

function first<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) throw new Error('Test fixture unexpectedly has no item.')
  return item
}

test('validatePlanRevision requires the revision to advance', () => {
  const plan = planFixture()
  const outcome = validatePlanRevision(plan, plan)
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /advance/)
})

test('validatePlanRevision flags an id that changed kind across revisions', () => {
  const previous = planFixture()
  const next = planFixture({
    source: { ...previous.source, planRevision: 'plan-2' },
    toolRecommendations: [
      {
        id: 'target-desktop',
        scope: 'repository',
        targetIds: [],
        recommendedChoice: 'x',
        packageNames: [],
        links: [],
        alternatives: [],
        reason: 'reused id',
        dependencyChanges: [],
        fileEffects: [],
        recommendationVersion: '1',
      },
    ],
  })
  const outcome = validatePlanRevision(previous, next)
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /changed kind/)
})

test('validateAcceptedSetupPlan accepts a subset derived from the source plan', () => {
  const source = planFixture()
  const outcome = validateAcceptedSetupPlan(source, acceptedPlanFixture(source))
  assert.equal(outcome.valid, true)
})

test('validateAcceptedSetupPlan rejects an id absent from the source plan', () => {
  const source = planFixture()
  const outcome = validateAcceptedSetupPlan(source, {
    ...acceptedPlanFixture(source),
    targets: [{ ...first(source.targets), id: 'invented-target' }],
  })
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /not present in the reviewed source plan/)
})

test('validateAcceptedSetupPlan rejects changed content with a reviewed id', () => {
  const source = planFixture()
  const target = first(source.targets)
  const outcome = validateAcceptedSetupPlan(source, {
    ...acceptedPlanFixture(source),
    targets: [{ ...target, name: 'Changed after review' }],
  })

  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /does not match the reviewed source plan/)
})

test('validateAcceptedSetupPlan rejects an incomplete fingerprint set', () => {
  const source = planFixture({
    source: {
      ...planFixture().source,
      fingerprints: { 'AGENTS.md': 'one', 'package.json': 'two' },
    },
  })
  const accepted = acceptedPlanFixture(source)
  const outcome = validateAcceptedSetupPlan(source, {
    ...accepted,
    fingerprints: { 'AGENTS.md': 'one' },
  })

  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /complete source fingerprint set/)
})

test('validateAcceptedSetupPlan rejects a stale fingerprint', () => {
  const source = planFixture()
  const outcome = validateAcceptedSetupPlan(source, {
    ...acceptedPlanFixture(source),
    fingerprints: { 'AGENTS.md': 'stale-hash' },
  })
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /Fingerprint/)
})
