import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type SetupPlan,
  parseSetupPlanningResult,
  validateAcceptedSetupPlan,
} from './setup-plan'
import { validatePlanRevision } from './setup-plan-validation'

function planFixture(overrides: Partial<SetupPlan> = {}): SetupPlan {
  return {
    source: {
      projectId: 'project-1',
      projectRoot: '/repo',
      skillRevision: 'skill-1',
      planRevision: 'plan-1',
      fingerprints: { 'AGENTS.md': 'hash-1' },
    },
    inventory: {
      instructions: ['AGENTS.md'],
      manifests: ['package.json'],
      packageManagers: ['bun'],
      workspaces: ['apps/desktop'],
      existingTools: [],
      currentConfiguration: {},
    },
    targets: [
      {
        id: 'target-desktop',
        name: 'desktop',
        path: 'apps/desktop',
        isDefault: true,
        evidence: 'package.json workspace entry',
        packageManager: 'bun',
        commands: { setup: 'bun install', test: 'bun test' },
        dependencies: [],
        risks: [],
      },
    ],
    capabilities: [
      {
        id: 'capability-quality-gates',
        name: 'setup-quality-gates',
        scope: 'repository',
        targetIds: [],
        disposition: 'recommended',
        evidence: 'no biome.jsonc found',
        reason: 'CI expects quality gates',
        effects: { files: ['biome.jsonc'], dependencies: [], generatedFiles: [], machineWide: false },
        consent: { required: true, personalOrMachineWide: false },
        applicationSteps: [{ id: 'step-write-biome', description: 'Write biome.jsonc', prerequisiteIds: [] }],
      },
    ],
    toolRecommendations: [],
    repositoryActions: [
      {
        id: 'action-write-biome',
        scope: 'repository',
        reason: 'Establish quality gates',
        evidence: 'no biome.jsonc found',
        fileCategories: ['config'],
        prerequisiteIds: [],
      },
    ],
    targetActions: [],
    verification: [
      {
        id: 'verify-desktop-test',
        targetId: 'target-desktop',
        capabilityId: 'capability-quality-gates',
        command: 'bun test',
        prerequisiteIds: ['action-write-biome'],
        expectedResult: 'tests pass',
        timeoutSeconds: 120,
        required: true,
      },
    ],
    risks: [],
    handoff: { mutationBoundary: 'setup worktree', acceptanceState: 'pending-review', applicationOrder: [] },
    ...overrides,
  }
}

test('accepts a well-formed ready-for-review planning result', () => {
  const result = parseSetupPlanningResult({
    status: 'ready-for-review',
    revision: 'plan-1',
    plan: planFixture(),
  })
  assert.equal(result.status, 'ready-for-review')
})

test('rejects a plan with duplicate target ids', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: { ...plan, targets: [...plan.targets, plan.targets[0]] },
      }),
    /Duplicate id/,
  )
})

test('rejects a nonempty target list with no default target', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: { ...plan, targets: [{ ...plan.targets[0]!, isDefault: false }] },
      }),
    /exactly one default target/,
  )
})

test('accepts a zero-target plan with no default target and no verification', () => {
  const result = parseSetupPlanningResult({
    status: 'ready-for-review',
    revision: 'plan-1',
    plan: planFixture({
      targets: [],
      capabilities: [],
      repositoryActions: [],
      verification: [],
    }),
  })
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
          verification: [{ ...plan.verification[0]!, targetId: 'missing-target' }],
        },
      }),
    /Unknown target id/,
  )
})

test('rejects a self-referencing prerequisite', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: {
          ...plan,
          repositoryActions: [{ ...plan.repositoryActions[0]!, prerequisiteIds: ['action-write-biome'] }],
        },
      }),
    /own prerequisite/,
  )
})

test('rejects a prerequisite cycle', () => {
  const plan = planFixture()
  assert.throws(
    () =>
      parseSetupPlanningResult({
        status: 'ready-for-review',
        revision: 'plan-1',
        plan: {
          ...plan,
          repositoryActions: [{ ...plan.repositoryActions[0]!, prerequisiteIds: ['verify-desktop-test'] }],
        },
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

test('validatePlanRevision requires the revision to advance', () => {
  const plan = planFixture()
  const outcome = validatePlanRevision(plan, plan)
  assert.equal(outcome.valid, false)
  assert.match(outcome.issues[0]!, /advance/)
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
  assert.match(outcome.issues[0]!, /changed kind/)
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
    targets: [{ ...source.targets[0]!, id: 'invented-target' }],
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
