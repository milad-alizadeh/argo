import type { ProjectSetupCommandRequest } from '@/domains/projects/contract/contract'
import { defaultProjectSetupHarnesses } from '@/domains/projects/contract/setup'
import type { ProjectSetupRuntime } from './actors/project-setup-actors'

export function commandHarnessIsAvailable(
  command: ProjectSetupCommandRequest['command'],
  runtime: ProjectSetupRuntime,
) {
  if (command.type !== 'choose-agent' && command.type !== 'choose-application-harness') return true
  return !runtime.harnesses.some(
    ({ harness, unavailableReason }) => harness === command.harness && unavailableReason !== null,
  )
}

export function eventFor(command: ProjectSetupCommandRequest['command']) {
  switch (command.type) {
    case 'choose-manual':
      return { type: 'Choose manual' } as const
    case 'choose-agent':
      return { type: 'Choose agent', harness: command.harness } as const
    case 'answer-questions':
      return { type: 'Answers sent', answers: command.answers } as const
    case 'request-plan-change':
      return { type: 'Request plan change', feedback: command.feedback } as const
    case 'continue-plan-review':
      return { type: 'Continue plan review' } as const
    case 'accept-plan':
      return { type: 'Accept plan', acceptedPlan: command.acceptedPlan } as const
    case 'choose-application-harness':
      return { type: 'Select application harness', harness: command.harness } as const
    case 'approve-final-diff':
      return { type: 'Approve final diff' } as const
    case 'request-application-change':
      return { type: 'Request application change', feedback: command.feedback } as const
    case 'cancel-setup':
      return { type: 'Cancel setup requested' } as const
    case 'retry-cancel':
      return { type: 'Retry cancel' } as const
    case 'approve-effect':
      return { type: 'Approve effect' } as const
    case 'reject-effect':
      return { type: 'Reject effect' } as const
    case 'resume-planning':
      return { type: 'Resume planning' } as const
    case 'resume-application':
      return { type: 'Resume application' } as const
    case 'restart-attempt':
      return { type: 'Restart attempt' } as const
    case 'defer':
      return { type: 'Defer' } as const
    case 'back':
      return { type: 'Back' } as const
    case 'save-manual':
      return { type: 'Save manual', source: command.source } as const
    case 'resume-setup':
      return { type: 'Resume setup' } as const
    case 'edit-setup':
      return { type: 'Edit setup' } as const
  }
}

export const defaultHarnesses = defaultProjectSetupHarnesses
