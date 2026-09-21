import type { ProjectSetupCommandRequest } from '@/domains/projects/contract/contract'
import { defaultProjectSetupHarnesses } from '@/domains/projects/contract/project-setup-harness'
import type { ProjectSetupEffects } from './project-setup-effects'

export function commandHarnessIsAvailable(
  command: ProjectSetupCommandRequest['command'],
  effects: ProjectSetupEffects | undefined,
) {
  if (command.type !== 'choose-agent' && command.type !== 'choose-application-harness') return true
  return !(effects?.harnesses?.() ?? defaultHarnesses).some(
    ({ harness, unavailableReason }) => harness === command.harness && unavailableReason !== null,
  )
}

export function eventFor(command: ProjectSetupCommandRequest['command']) {
  switch (command.type) {
    case 'choose-manual':
      return { type: 'CHOOSE_MANUAL' } as const
    case 'choose-agent':
      return { type: 'CHOOSE_AGENT', harness: command.harness } as const
    case 'retry-preflight':
      return { type: 'RETRY_PREFLIGHT' } as const
    case 'answer-questions':
      return { type: 'ANSWERS_SENT' } as const
    case 'request-plan-change':
      return { type: 'REQUEST_PLAN_CHANGE' } as const
    case 'accept-plan':
      return { type: 'ACCEPT_PLAN', acceptedPlan: command.acceptedPlan } as const
    case 'choose-application-harness':
      return { type: 'CHOOSE_APPLICATION_HARNESS', harness: command.harness } as const
    case 'approve-final-diff':
      return { type: 'APPROVE_FINAL_DIFF' } as const
    case 'reject-final-diff':
      return { type: 'REJECT_FINAL_DIFF' } as const
    case 'cancel-setup':
      return { type: 'CANCEL_SETUP_REQUESTED' } as const
    case 'retry-cancel':
      return { type: 'RETRY_CANCEL' } as const
    case 'approve-effect':
      return { type: 'APPROVE_EFFECT' } as const
    case 'reject-effect':
      return { type: 'REJECT_EFFECT' } as const
    case 'resume-planning':
      return { type: 'RESUME_PLANNING' } as const
    case 'resume-application':
      return { type: 'RESUME_APPLICATION' } as const
    case 'restart-attempt':
      return { type: 'RESTART_ATTEMPT' } as const
    case 'defer':
      return { type: 'DEFER' } as const
    case 'back':
      return { type: 'BACK' } as const
    case 'save-manual':
      return { type: 'SAVE_MANUAL', source: command.source } as const
    case 'resume-setup':
      return { type: 'RESUME_SETUP' } as const
    case 'start-repair-or-upgrade':
      return { type: 'START_REPAIR_OR_UPGRADE' } as const
  }
}

export const defaultHarnesses = defaultProjectSetupHarnesses
