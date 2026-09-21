import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fromCallback } from 'xstate'
import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import { runApplicationAgent } from '@/domains/projects/main/setup/onboarding-agent/application/run-application-agent'
import { prepareSetupWorktree } from '@/domains/projects/main/setup/preparation/setup-worktree'
import type {
  ProjectSetupContext,
  ProjectSetupEvent,
} from '@/domains/projects/main/setup/project-setup-machine-types'
import { findProjectSetupApplicationDrift } from '@/domains/projects/main/setup/project-setup-reconciliation'
import { startProjectSetupActorTask } from './project-setup-actor-task'
import type { ProjectSetupServices } from './project-setup-actors'
import {
  type ActivePermission,
  projectSetupPermissionDecisionHandler,
} from './project-setup-permission-decisions'
import { projectSetupProgressReporter } from './project-setup-progress'

const runFile = promisify(execFile)

export type ProjectSetupApplicationInput = {
  acceptedPlan: AcceptedSetupPlan | null
  feedback?: string
  harness: 'claude' | 'codex' | null
  sessionId?: string
}

export function projectSetupApplicationInput(
  context: ProjectSetupContext,
  event: ProjectSetupEvent,
): ProjectSetupApplicationInput {
  return {
    acceptedPlan: context.acceptedPlan,
    feedback: event.type === 'Request application change' ? event.feedback : undefined,
    harness: context.applicationHarness,
    sessionId:
      event.type === 'Resume application' || event.type === 'Request application change'
        ? (context.applicationSessionId ?? undefined)
        : undefined,
  }
}

export function projectSetupApplicationActor(services: ProjectSetupServices, projectId: string) {
  return fromCallback<ProjectSetupEvent, ProjectSetupApplicationInput, ProjectSetupEvent>(
    ({ input, receive, sendBack }) => {
      const activePermission: ActivePermission = {
        permissionId: null,
        sessionId: input.sessionId ?? null,
      }
      receive(projectSetupPermissionDecisionHandler(services.driver, activePermission))
      return startProjectSetupActorTask(() =>
        runApplication({ activePermission, input, projectId, sendBack, services }),
      )
    },
  )
}

type ApplicationRun = {
  activePermission: ActivePermission
  input: ProjectSetupApplicationInput
  projectId: string
  sendBack: (event: ProjectSetupEvent) => void
  services: ProjectSetupServices
}

async function runApplication(applicationRun: ApplicationRun): Promise<void> {
  const { input, sendBack } = applicationRun
  if (!input.acceptedPlan || !input.harness) return
  try {
    await applyProjectSetup({
      ...applicationRun,
      input: { ...input, acceptedPlan: input.acceptedPlan },
    })
  } catch (error) {
    console.error('Project setup application failed.', error)
    sendBack({
      type: 'Effect interrupted',
      reason: 'interrupted',
    })
  }
}

async function applyProjectSetup(
  applicationRun: ApplicationRun & {
    input: ProjectSetupApplicationInput & { acceptedPlan: AcceptedSetupPlan }
  },
): Promise<void> {
  const { activePermission, input, projectId, sendBack, services } = applicationRun
  const project = services.projects.read().projects.find((candidate) => candidate.id === projectId)
  if (input.harness !== 'claude' || !project)
    return sendBack({ type: 'Invalid output', issues: ['The selected agent cannot apply setup.'] })
  const drift = await findProjectSetupApplicationDrift({
    acceptedPlan: input.acceptedPlan,
    driver: services.driver,
    projectId,
    projectPath: project.path,
    projects: services.projects,
    sessionId: input.sessionId,
  })
  if (drift)
    return sendBack({
      type: 'Application drift',
      reason: drift,
      finalDiff: await projectDiff(project.path),
    })
  const setupWorktreePath = await prepareSetupWorktree(project)
  services.projects.writeSetupCheckpoint({
    projectId: project.id,
    worktreePath: setupWorktreePath,
    phase: 'validating',
    configurationSource: '',
    documentRevision: input.acceptedPlan.sourceRevision,
  })
  const result = await runApplicationAgent(services.driver, {
    projectRoot: project.path,
    setupWorktreePath,
    acceptedPlan: input.acceptedPlan,
    feedback: input.feedback,
    sessionId: input.sessionId,
    onStarted: (sessionId) => {
      activePermission.sessionId = sessionId
      sendBack({ type: 'Application session started', sessionId })
    },
    onPermission: ({ description, id }) => {
      activePermission.permissionId = id
      sendBack({ type: 'Permission requested', permissionId: id, description })
    },
    onStepEvent: projectSetupProgressReporter((progress) =>
      sendBack({ type: 'Progress received', progress }),
    ),
  })
  if (result.kind !== 'report' || result.report.outcome !== 'completed')
    return sendBack({
      type: 'Invalid output',
      issues:
        result.kind === 'invalid-output'
          ? result.issues
          : ['The application result was not complete.'],
    })
  const diff = await runFile('git', ['-C', setupWorktreePath, 'diff', '--no-ext-diff'])
  sendBack({ type: 'Application completed', finalDiff: diff.stdout, progress: [] })
}

async function projectDiff(projectRoot: string) {
  try {
    return (await runFile('git', ['-C', projectRoot, 'diff', 'HEAD', '--no-ext-diff'])).stdout
  } catch {
    return ''
  }
}
