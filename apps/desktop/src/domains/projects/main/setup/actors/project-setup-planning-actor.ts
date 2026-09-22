import { fromCallback } from 'xstate'
import type { ProjectSetupAnswer } from '@/domains/projects/contract/setup'
import { runPlanningAgent } from '../onboarding-agent/planning/run-planning-agent'
import { prepareSetupWorktree } from '../preparation/setup-worktree'
import type { ProjectSetupContext, ProjectSetupEvent } from '../project-setup-machine-types'
import { startProjectSetupActorTask } from './project-setup-actor-task'
import type { ProjectSetupServices } from './project-setup-actors'
import {
  type ActivePermission,
  projectSetupPermissionDecisionHandler,
} from './project-setup-permission-decisions'
import { projectSetupProgressReporter } from './project-setup-progress'

export type ProjectSetupPlanningInput = {
  continuation?: { prompt: string; sessionId: string }
  harness: 'claude' | 'codex' | null
}

export function projectSetupPlanningInput(
  context: ProjectSetupContext,
  event: ProjectSetupEvent,
): ProjectSetupPlanningInput {
  switch (event.type) {
    case 'Answers sent':
      return continuationInput(
        context,
        `The person answered the focused setup questions:\n${event.answers.map(formatAnswer).join('\n')}\nContinue the same planning pass and return the complete next result.`,
      )
    case 'Request plan change':
      return continuationInput(
        context,
        `Revise the plan in response to this review feedback:\n${event.feedback}\nKeep this Attempt and return the complete revised result.`,
      )
    case 'Invalid output':
      return continuationInput(
        context,
        `Your previous planning result did not match the required schema:\n${event.issues.map((issue) => `- ${issue}`).join('\n')}\nFix the result and return the complete schema-valid plan.`,
      )
    case 'Resume planning':
      return continuationInput(
        context,
        'Reconcile the recorded Project source and continue this same planning Attempt.',
      )
    default:
      return { harness: context.selectedHarness }
  }
}

function formatAnswer(answer: ProjectSetupAnswer) {
  const selected = answer.selections.length ? answer.selections.join(', ') : 'none selected'
  const custom = answer.custom.trim() || 'no additional answer'
  return `- ${answer.id}: selected [${selected}]; other: ${custom}`
}

export function projectSetupPlanningActor(services: ProjectSetupServices, projectId: string) {
  return fromCallback<ProjectSetupEvent, ProjectSetupPlanningInput, ProjectSetupEvent>(
    ({ input, receive, sendBack }) => {
      const activePermission: ActivePermission = {
        permissionId: null,
        sessionId: input.continuation?.sessionId ?? null,
      }
      receive(projectSetupPermissionDecisionHandler(services.driver, activePermission))
      return startProjectSetupActorTask(() =>
        runPlanning({ activePermission, input, projectId, sendBack, services }),
      )
    },
  )
}

type PlanningRun = {
  activePermission: ActivePermission
  input: ProjectSetupPlanningInput
  projectId: string
  sendBack: (event: ProjectSetupEvent) => void
  services: ProjectSetupServices
}

async function runPlanning({
  activePermission,
  input,
  projectId,
  sendBack,
  services,
}: PlanningRun): Promise<void> {
  if (!input.harness) return
  try {
    const project = services.projects
      .read()
      .projects.find((candidate) => candidate.id === projectId)
    if (input.harness !== 'claude' || !project)
      return sendBack({ type: 'Invalid output', issues: ['The selected agent cannot plan.'] })
    const document = await services.loadSetupDocument()
    const result = await runPlanningAgent(services.driver, {
      projectRoot: project.path,
      setupWorktreePath: await prepareSetupWorktree(project),
      skillPrompt: JSON.stringify(document),
      skillRevision: document.revision,
      planRevision: crypto.randomUUID(),
      onStarted: (sessionId) => {
        activePermission.sessionId = sessionId
        sendBack({ type: 'Planning session started', sessionId })
      },
      onPermission: ({ description, id }) => {
        activePermission.permissionId = id
        sendBack({ type: 'Permission requested', permissionId: id, description })
      },
      sessionId: input.continuation?.sessionId,
      continuationPrompt: input.continuation?.prompt,
      onStepEvent: projectSetupProgressReporter((progress) =>
        sendBack({ type: 'Progress received', progress }),
      ),
    })
    sendBack(planningResultEvent(result))
  } catch (error) {
    console.error('Project setup planning failed.', error)
    sendBack({ type: 'Effect interrupted', reason: 'interrupted' })
  }
}

function planningResultEvent(
  result: Awaited<ReturnType<typeof runPlanningAgent>>,
): ProjectSetupEvent {
  if (result.kind !== 'result') {
    return {
      type: 'Invalid output',
      issues:
        result.kind === 'invalid-output'
          ? result.issues
          : ['The planning result timed out before it was complete.'],
    }
  }
  switch (result.result.status) {
    case 'needs-user-input':
      return { type: 'Questions received', questions: result.result.questions }
    case 'ready-for-review':
      return { type: 'Plan validated', plan: result.result.plan }
    case 'cannot-plan':
      return {
        type: 'Invalid output',
        issues: [result.result.reason, result.result.evidence, result.result.recoveryAction],
      }
  }
}

function continuationInput(
  context: ProjectSetupContext,
  prompt: string,
): ProjectSetupPlanningInput {
  return {
    harness: context.selectedHarness,
    continuation: context.planningSessionId
      ? { prompt, sessionId: context.planningSessionId }
      : undefined,
  }
}
