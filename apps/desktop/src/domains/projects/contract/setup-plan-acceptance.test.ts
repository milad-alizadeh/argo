import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcceptedSetupPlan } from './setup-plan'
import { planFixture } from './setup-plan.fixture'
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
  const outcome = validateAcceptedSetupPlan(source, {
    sourceRevision: source.source.planRevision,
    projectRoot: source.source.projectRoot,
    fingerprints: source.source.fingerprints,
    targets: source.targets,
    capabilities: source.capabilities.map(({ disposition: _disposition, ...rest }) => rest),
    toolRecommendations: source.toolRecommendations,
    repositoryActions: source.repositoryActions,
    targetActions: source.targetActions,
    verification: source.verification,
    handoff: source.handoff,
  })
  assert.equal(outcome.valid, true)
})

test('validateAcceptedSetupPlan rejects an id absent from the source plan', () => {
  const source = planFixture()
  const outcome = validateAcceptedSetupPlan(source, {
    sourceRevision: source.source.planRevision,
    projectRoot: source.source.projectRoot,
    fingerprints: source.source.fingerprints,
    targets: [{ ...first(source.targets), id: 'invented-target' }],
    capabilities: [],
    toolRecommendations: [],
    repositoryActions: [],
    targetActions: [],
    verification: [],
    handoff: source.handoff,
  })
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /not present in the reviewed source plan/)
})

test('validateAcceptedSetupPlan rejects a stale fingerprint', () => {
  const source = planFixture()
  const outcome = validateAcceptedSetupPlan(source, {
    sourceRevision: source.source.planRevision,
    projectRoot: source.source.projectRoot,
    fingerprints: { 'AGENTS.md': 'stale-hash' },
    targets: [],
    capabilities: [],
    toolRecommendations: [],
    repositoryActions: [],
    targetActions: [],
    verification: [],
    handoff: source.handoff,
  })
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues.join('\n'), /Fingerprint/)
})
