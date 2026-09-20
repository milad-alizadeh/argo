import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import type { OnboardingAgentDriver } from './run-onboarding-agent'
import { runApplicationAgent } from './run-application-agent'

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

const acceptedPlan: AcceptedSetupPlan = {
  sourceRevision: 'plan-1',
  projectRoot: '/repo',
  fingerprints: {},
  targets: [],
  capabilities: [],
  toolRecommendations: [],
  repositoryActions: [],
  targetActions: [],
  verification: [],
  handoff: { mutationBoundary: 'setup worktree', acceptanceState: 'accepted', applicationOrder: [] },
}

test('parses a completed application report behind the apply marker', async () => {
  const outcome = await runApplicationAgent(
    driverEmitting(
      'ARGO_STEP {"stepId":"write-biome","status":"passed","message":"Wrote biome.jsonc"}\n' +
        'ARGO_APPLY_REPORT\n```json\n{"outcome":"completed","steps":[{"stepId":"write-biome","status":"passed","message":"ok"}]}\n```',
    ),
    { projectRoot: '/repo', setupWorktreePath: '/repo/.argo/worktrees/setup-1', acceptedPlan, pollIntervalMs: 1 },
  )
  assert.equal(outcome.kind, 'report')
  assert.equal(outcome.kind === 'report' && outcome.report.outcome, 'completed')
})

test('reports a needs-review outcome with the drift explanation', async () => {
  const outcome = await runApplicationAgent(
    driverEmitting(
      'ARGO_APPLY_REPORT\n```json\n{"outcome":"needs-review","steps":[],"drift":"AGENTS.md changed since planning"}\n```',
    ),
    { projectRoot: '/repo', setupWorktreePath: '/repo/.argo/worktrees/setup-1', acceptedPlan, pollIntervalMs: 1 },
  )
  assert.equal(outcome.kind, 'report')
  assert.equal(outcome.kind === 'report' && outcome.report.drift, 'AGENTS.md changed since planning')
})
