import { randomUUID } from 'node:crypto'
import type { AcceptedSetupPlan, SetupPlanningResult } from '@/domains/projects/contract/setup-plan'
import type {
  SetupApplicationProgressEvent,
  SetupPlanningProgressEvent,
} from '@/domains/projects/contract/setup-progress'
import { runApplicationAgent } from './run-application-agent'
import type { OnboardingAgentDriver } from './run-onboarding-agent'
import { runPlanningAgent } from './run-planning-agent'

type PlanRun = {
  outcome: 'running' | 'ready' | 'invalid-output' | 'timed-out'
  events: SetupPlanningProgressEvent[]
  result: SetupPlanningResult | null
  issues: string[]
}

type ApplyRun = {
  outcome: 'running' | 'completed' | 'needs-review' | 'failed' | 'invalid-output' | 'timed-out'
  events: SetupApplicationProgressEvent[]
  steps: Array<{ stepId: string; status: 'passed' | 'failed'; message: string }>
  drift: string | null
  issues: string[]
}

// One process-lifetime store: an onboarding run tracks one managed Session's one-shot turn, and
// nothing here needs to survive a relaunch (the plan or report it produces does, once accepted).
export function createOnboardingRunStore(driver: OnboardingAgentDriver) {
  const planRuns = new Map<string, PlanRun>()
  const applyRuns = new Map<string, ApplyRun>()

  function startPlanRun(request: {
    projectRoot: string
    setupWorktreePath: string
    skillPrompt: string
    skillRevision: string
    planRevision: string
    priorPlanJson?: string
  }): string {
    const runId = randomUUID()
    const run: PlanRun = { outcome: 'running', events: [], result: null, issues: [] }
    planRuns.set(runId, run)
    runPlanningAgent(driver, {
      ...request,
      onStepEvent: (event) => run.events.push(event),
    }).then((outcome) => {
      if (outcome.kind === 'result') {
        run.outcome = 'ready'
        run.result = outcome.result
      } else if (outcome.kind === 'invalid-output') {
        run.outcome = 'invalid-output'
        run.issues = outcome.issues
      } else {
        run.outcome = 'timed-out'
      }
    })
    return runId
  }

  function planStatus(runId: string): PlanRun | null {
    return planRuns.get(runId) ?? null
  }

  function startApplyRun(request: {
    projectRoot: string
    setupWorktreePath: string
    acceptedPlan: AcceptedSetupPlan
  }): string {
    const runId = randomUUID()
    const run: ApplyRun = { outcome: 'running', events: [], steps: [], drift: null, issues: [] }
    applyRuns.set(runId, run)
    runApplicationAgent(driver, {
      ...request,
      onStepEvent: (event) => run.events.push(event),
    }).then((outcome) => {
      if (outcome.kind === 'report') {
        run.outcome = outcome.report.outcome
        run.steps = outcome.report.steps
        run.drift = outcome.report.drift ?? null
      } else if (outcome.kind === 'invalid-output') {
        run.outcome = 'invalid-output'
        run.issues = outcome.issues
      } else {
        run.outcome = 'timed-out'
      }
    })
    return runId
  }

  function applyStatus(runId: string): ApplyRun | null {
    return applyRuns.get(runId) ?? null
  }

  return { startPlanRun, planStatus, startApplyRun, applyStatus }
}

export type OnboardingRunStore = ReturnType<typeof createOnboardingRunStore>
