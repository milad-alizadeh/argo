import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { OnboardingAgentDriver } from './run-onboarding-agent'
import { runPlanningAgent } from './run-planning-agent'

function driverEmitting(...frames: string[]): OnboardingAgentDriver {
  let index = 0
  return {
    start: () => 'session-1',
    liveMessages: () => {
      const text = frames[Math.min(index, frames.length - 1)] ?? ''
      index += 1
      return [{ id: 'message-1', text }]
    },
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => false,
  }
}

const readyPlan = {
  status: 'ready-for-review',
  revision: 'plan-1',
  plan: {
    source: {
      projectId: 'p1',
      projectRoot: '/repo',
      skillRevision: 's1',
      planRevision: 'plan-1',
      fingerprints: {},
    },
    inventory: {
      instructions: [],
      manifests: [],
      packageManagers: [],
      workspaces: [],
      existingTools: [],
      currentConfiguration: {},
    },
    targets: [],
    capabilities: [],
    toolRecommendations: [],
    repositoryActions: [],
    targetActions: [],
    verification: [],
    risks: [],
    handoff: {
      mutationBoundary: 'setup worktree',
      acceptanceState: 'pending-review',
      applicationOrder: [],
    },
  },
}

test('parses a ready-for-review result behind the plan marker', async () => {
  const outcome = await runPlanningAgent(
    driverEmitting(
      'ARGO_STEP {"stepId":"identify-targets","status":"running","message":"Scanning"}',
      `ARGO_SETUP_PLAN\n\`\`\`json\n${JSON.stringify(readyPlan)}\n\`\`\``,
    ),
    {
      projectRoot: '/repo',
      setupWorktreePath: '/repo/.argo/worktrees/setup-1',
      skillPrompt: 'skill body',
      skillRevision: 's1',
      planRevision: 'plan-1',
      pollIntervalMs: 1,
    },
  )
  assert.equal(outcome.kind, 'result')
  assert.equal(outcome.kind === 'result' && outcome.result.status, 'ready-for-review')
})

test('forwards ARGO_STEP lines as typed progress events', async () => {
  const events: string[] = []
  await runPlanningAgent(
    driverEmitting(
      'ARGO_STEP {"stepId":"identify-targets","status":"running","message":"Scanning"}',
      `ARGO_STEP {"stepId":"identify-targets","status":"running","message":"Scanning"}\nARGO_SETUP_PLAN\n\`\`\`json\n${JSON.stringify(readyPlan)}\n\`\`\``,
    ),
    {
      projectRoot: '/repo',
      setupWorktreePath: '/repo/.argo/worktrees/setup-1',
      skillPrompt: 'skill body',
      skillRevision: 's1',
      planRevision: 'plan-1',
      onStepEvent: (event) => events.push(event.stepId),
      pollIntervalMs: 1,
    },
  )
  assert.deepEqual(events, ['identify-targets'])
})

test('reports invalid output when the marked payload fails schema validation', async () => {
  const outcome = await runPlanningAgent(
    driverEmitting('ARGO_SETUP_PLAN\n```json\n{"status":"unknown"}\n```'),
    {
      projectRoot: '/repo',
      setupWorktreePath: '/repo/.argo/worktrees/setup-1',
      skillPrompt: 'skill body',
      skillRevision: 's1',
      planRevision: 'plan-1',
      pollIntervalMs: 1,
    },
  )
  assert.equal(outcome.kind, 'invalid-output')
})
