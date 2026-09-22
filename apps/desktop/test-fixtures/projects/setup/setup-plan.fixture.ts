import type { AcceptedSetupPlan, SetupPlan } from '@/domains/projects/contract/setup/setup-plan'

function source(): SetupPlan['source'] {
  return {
    projectId: 'project-1',
    projectRoot: '/repo',
    skillRevision: 'skill-1',
    planRevision: 'plan-1',
    fingerprints: { 'AGENTS.md': 'hash-1' },
  }
}

function inventory(): SetupPlan['inventory'] {
  return {
    instructions: ['AGENTS.md'],
    manifests: ['package.json'],
    packageManagers: ['bun'],
    workspaces: ['apps/desktop'],
    existingTools: [],
    currentConfiguration: {},
  }
}

function target(): SetupPlan['targets'][number] {
  return {
    id: 'target-desktop',
    name: 'desktop',
    path: 'apps/desktop',
    isDefault: true,
    evidence: 'package.json workspace entry',
    packageManager: 'bun',
    commands: { setup: 'bun install', test: 'bun test' },
    dependencies: [],
    risks: [],
  }
}

function capability(): SetupPlan['capabilities'][number] {
  return {
    id: 'capability-quality-gates',
    name: 'setup-quality-gates',
    scope: 'repository',
    targetIds: [],
    disposition: 'recommended',
    evidence: 'no biome.jsonc found',
    reason: 'CI expects quality gates',
    effects: { files: ['biome.jsonc'], dependencies: [], generatedFiles: [], machineWide: false },
    consent: { required: true, personalOrMachineWide: false },
    applicationSteps: [
      { id: 'step-write-biome', description: 'Write biome.jsonc', prerequisiteIds: [] },
    ],
  }
}

function repositoryAction(): SetupPlan['repositoryActions'][number] {
  return {
    id: 'action-write-biome',
    scope: 'repository',
    reason: 'Establish quality gates',
    evidence: 'no biome.jsonc found',
    fileCategories: ['config'],
    prerequisiteIds: [],
  }
}

function verification(): SetupPlan['verification'][number] {
  return {
    id: 'verify-desktop-test',
    targetId: 'target-desktop',
    capabilityId: 'capability-quality-gates',
    command: 'bun test',
    prerequisiteIds: ['action-write-biome'],
    expectedResult: 'tests pass',
    timeoutSeconds: 120,
    required: true,
  }
}

export function planFixture(overrides: Partial<SetupPlan> = {}): SetupPlan {
  return {
    source: source(),
    inventory: inventory(),
    targets: [target()],
    capabilities: [capability()],
    toolRecommendations: [],
    repositoryActions: [repositoryAction()],
    targetActions: [],
    verification: [verification()],
    risks: [],
    handoff: {
      mutationBoundary: 'setup worktree',
      acceptanceState: 'pending-review',
      applicationOrder: [],
    },
    ...overrides,
  }
}

export function acceptedPlanFixture(source: SetupPlan): AcceptedSetupPlan {
  return {
    sourceRevision: source.source.planRevision,
    projectRoot: source.source.projectRoot,
    fingerprints: source.source.fingerprints,
    targets: source.targets,
    capabilities: source.capabilities.map(
      ({ disposition: _disposition, ...capability }) => capability,
    ),
    toolRecommendations: source.toolRecommendations,
    repositoryActions: source.repositoryActions,
    targetActions: source.targetActions,
    verification: source.verification,
    handoff: source.handoff,
  }
}
