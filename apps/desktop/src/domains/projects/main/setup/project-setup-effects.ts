import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  ProjectSetupHarness,
  ProjectSetupHarnessAvailability,
} from '@/domains/projects/contract/project-setup-harness'
import type { SetupDocument } from '@/domains/projects/contract/setup-document'
import type { AcceptedSetupPlan, SetupPlan } from '@/domains/projects/contract/setup-plan'
import type { SetupStepStatus } from '@/domains/projects/contract/setup-progress'
import { runApplicationAgent } from '@/domains/projects/main/setup/onboarding-agent/run-application-agent'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/run-onboarding-agent'
import { runPlanningAgent } from '@/domains/projects/main/setup/onboarding-agent/run-planning-agent'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { defaultHarnesses } from './project-setup-command'
import { cancelProjectSetup, createProgressReporter } from './project-setup-effect-support'
import { promoteSetupWorktree } from './project-setup-finalization'
import { planningResult } from './project-setup-planning-result'
import { reconcileProjectSetupApplication } from './project-setup-reconciliation'
import { prepareSetupWorktree } from './setup-worktree'
import { observeSourceFingerprints } from './source-fingerprints'

const run = promisify(execFile)

export type ProjectSetupEffects = {
  harnesses?: () => ProjectSetupHarnessAvailability[]
  preflight: (request: { harness: ProjectSetupHarness; projectId: string }) => Promise<boolean>
  plan: (request: {
    harness: ProjectSetupHarness
    continuation?: { prompt: string; sessionId: string }
    onStarted: (sessionId: string) => void
    onPermission?: (permission: { id: string; description: string }) => void
    onProgress: (
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>,
    ) => void
    projectId: string
  }) => Promise<
    | { kind: 'questions'; questions: Array<{ id: string; prompt: string }> }
    | { kind: 'plan'; plan: SetupPlan }
    | { kind: 'invalid' }
  >
  apply: (request: {
    acceptedPlan: AcceptedSetupPlan
    harness: ProjectSetupHarness
    onProgress: (
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>,
    ) => void
    onStarted: (sessionId: string) => void
    onPermission?: (permission: { id: string; description: string }) => void
    projectId: string
    sessionId?: string
  }) => Promise<{ finalDiff: string } | { kind: 'drifted'; reason: string } | { kind: 'invalid' }>
  cancel?: (request: {
    effect: 'planning' | 'application'
    projectId: string
    sessionId: string
  }) => Promise<void>
  decidePermission?: (request: { sessionId: string; permissionId: string; allow: boolean }) => void
  reconcile?: (request: {
    acceptedPlan: AcceptedSetupPlan
    projectId: string
    sessionId: string
  }) => Promise<{ kind: 'current' } | { kind: 'drifted'; reason: string }>
  complete?: (projectId: string) => Promise<void> | void
}

type ProjectSetupServices = {
  driver: OnboardingAgentDriver
  loadSetupDocument: () => Promise<SetupDocument>
  projects: ProjectStore
}

export function createClaudeProjectSetupEffects({
  driver,
  loadSetupDocument,
  projects,
}: {
  driver: OnboardingAgentDriver
  loadSetupDocument: () => Promise<SetupDocument>
  projects: ProjectStore
}): ProjectSetupEffects {
  const services = { driver, loadSetupDocument, projects }
  return {
    harnesses: () => defaultHarnesses,
    preflight: async ({ harness, projectId }) =>
      harness === 'claude' && projectExists(projects, projectId),
    plan: (request) => planProjectSetup(services, request),
    apply: (request) => applyProjectSetup(services, request),
    cancel: ({ sessionId }) => cancelProjectSetup(driver, sessionId),
    decidePermission: ({ allow, permissionId, sessionId }) => {
      driver.decidePermission(sessionId, permissionId, allow ? 'allowSimilar' : 'deny')
    },
    reconcile: (request) => reconcileProjectSetupApplication({ ...request, driver, projects }),
    complete: (projectId) => promoteSetupWorktree(projects, projectId),
  }
}

function projectExists(projects: ProjectStore, projectId: string) {
  return projects.read().projects.some((project) => project.id === projectId)
}

function projectFor(projects: ProjectStore, projectId: string) {
  return projects.read().projects.find((project) => project.id === projectId)
}

async function planProjectSetup(
  { driver, loadSetupDocument, projects }: ProjectSetupServices,
  request: Parameters<ProjectSetupEffects['plan']>[0],
): ReturnType<ProjectSetupEffects['plan']> {
  if (request.harness !== 'claude') return { kind: 'invalid' }
  const project = projectFor(projects, request.projectId)
  if (!project) return { kind: 'invalid' }
  const document = await loadSetupDocument()
  const result = await runPlanningAgent(driver, {
    projectRoot: project.path,
    setupWorktreePath: await prepareSetupWorktree(project),
    skillPrompt: JSON.stringify(document),
    skillRevision: document.revision,
    planRevision: crypto.randomUUID(),
    onStarted: request.onStarted,
    onPermission: request.onPermission,
    sessionId: request.continuation?.sessionId,
    continuationPrompt: request.continuation?.prompt,
    onStepEvent: createProgressReporter(request.onProgress),
  })
  return planningResult(result)
}

async function applyProjectSetup(
  { driver, projects }: ProjectSetupServices,
  request: Parameters<ProjectSetupEffects['apply']>[0],
): ReturnType<ProjectSetupEffects['apply']> {
  if (request.harness !== 'claude') return { kind: 'invalid' }
  const project = projectFor(projects, request.projectId)
  if (!project) return { kind: 'invalid' }
  const source = await observeSourceFingerprints(project.path, request.acceptedPlan.fingerprints)
  if (source.kind === 'drifted') return source
  const setupWorktreePath = await prepareSetupWorktree(project)
  projects.writeSetupCheckpoint({
    projectId: project.id,
    worktreePath: setupWorktreePath,
    phase: 'validating',
    configurationSource: '',
    documentRevision: request.acceptedPlan.sourceRevision,
  })
  const result = await runApplicationAgent(driver, {
    projectRoot: project.path,
    setupWorktreePath,
    acceptedPlan: request.acceptedPlan,
    onStarted: request.onStarted,
    onPermission: request.onPermission,
    sessionId: request.sessionId,
    onStepEvent: createProgressReporter(request.onProgress),
  })
  if (result.kind !== 'report' || result.report.outcome !== 'completed') return { kind: 'invalid' }
  const diff = await run('git', ['-C', setupWorktreePath, 'diff', '--no-ext-diff'])
  return { finalDiff: diff.stdout }
}
