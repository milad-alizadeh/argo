import { randomUUID } from 'node:crypto'
import { type ProjectError, projectError } from '@/domains/projects/contract/contract'
import type {
  OnboardingApplyStartRequest,
  OnboardingApplyStatus,
  OnboardingApplyStatusRequest,
  OnboardingPlanStartRequest,
  OnboardingPlanStatus,
  OnboardingPlanStatusRequest,
  OnboardingRunStarted,
} from '@/domains/projects/contract/onboarding-contract'
import { projectFor, type SetupStore } from '@/domains/projects/main/setup/setup-context'
import { prepareSetupWorktree } from '@/domains/projects/main/setup/setup-worktree'
import type { OnboardingRunStore } from './onboarding-run-store'

export type OnboardingContext = { setup: SetupStore; runs: OnboardingRunStore }

export async function startOnboardingPlan(
  request: OnboardingPlanStartRequest,
  context: OnboardingContext,
): Promise<OnboardingRunStarted | ProjectError> {
  if (request.harness !== 'claude')
    return projectError('onboarding-harness-unavailable', request.requestId)
  const project = projectFor(request.projectId, context.setup.projects)
  if (!project) return projectError('missing-project', request.requestId)
  let document: Awaited<ReturnType<SetupStore['loadSetupDocument']>>
  try {
    document = await context.setup.loadSetupDocument()
  } catch {
    return projectError('setup-unavailable', request.requestId)
  }
  const checkpoint = context.setup.projects.readSetupCheckpoint(project.id)
  const setupWorktreePath = checkpoint?.worktreePath ?? (await prepareSetupWorktree(project))
  const runId = context.runs.startPlanRun({
    projectRoot: project.path,
    setupWorktreePath,
    skillPrompt: JSON.stringify(document),
    skillRevision: document.revision,
    // Every plan.start begins a fresh revision: the guided-setup MVP has no persisted plan to
    // resume, so `priorPlanJson` stays unset and each run's plan is revision one of a new lineage.
    planRevision: randomUUID(),
  })
  return { version: 1, type: 'onboarding.run.started', requestId: request.requestId, runId }
}

export function onboardingPlanStatus(
  request: OnboardingPlanStatusRequest,
  context: OnboardingContext,
): OnboardingPlanStatus | ProjectError {
  const run = context.runs.planStatus(request.runId)
  if (!run) return projectError('onboarding-run-not-found', request.requestId)
  return {
    version: 1,
    type: 'onboarding.plan.status-report',
    requestId: request.requestId,
    runId: request.runId,
    outcome: run.outcome,
    events: run.events,
    result: run.result,
    issues: run.issues,
  }
}

export async function startOnboardingApply(
  request: OnboardingApplyStartRequest,
  context: OnboardingContext,
): Promise<OnboardingRunStarted | ProjectError> {
  if (request.harness !== 'claude')
    return projectError('onboarding-harness-unavailable', request.requestId)
  const project = projectFor(request.projectId, context.setup.projects)
  if (!project) return projectError('missing-project', request.requestId)
  const checkpoint = context.setup.projects.readSetupCheckpoint(project.id)
  const setupWorktreePath = checkpoint?.worktreePath ?? (await prepareSetupWorktree(project))
  const runId = context.runs.startApplyRun({
    projectRoot: project.path,
    setupWorktreePath,
    acceptedPlan: request.acceptedPlan,
  })
  return { version: 1, type: 'onboarding.run.started', requestId: request.requestId, runId }
}

export function onboardingApplyStatus(
  request: OnboardingApplyStatusRequest,
  context: OnboardingContext,
): OnboardingApplyStatus | ProjectError {
  const run = context.runs.applyStatus(request.runId)
  if (!run) return projectError('onboarding-run-not-found', request.requestId)
  return {
    version: 1,
    type: 'onboarding.apply.status-report',
    requestId: request.requestId,
    runId: request.runId,
    outcome: run.outcome,
    events: run.events,
    steps: run.steps,
    drift: run.drift,
    issues: run.issues,
  }
}
