import { type AssignAction, assign, type MachineConfig, type ProvidedActor } from 'xstate'
import { updateCurrentAttemptEvidence } from './project-setup-attempt-evidence'
import type { ProjectSetupContext, ProjectSetupEvent } from './project-setup-machine-types'

type ProjectSetupStates = NonNullable<
  MachineConfig<ProjectSetupContext, ProjectSetupEvent>['states']
>

export const projectSetupRunningStates = {
  planning: {
    on: {
      CANCEL_SETUP_REQUESTED: 'cancelling',
      EFFECT_INTENT_SAVED: { actions: assign({ activeEffect: ({ event }) => event.effect }) },
      PLANNING_SESSION_STARTED: {
        actions: sessionStartedAction('planning'),
      },
      QUESTIONS_RECEIVED: {
        target: 'questions',
        actions: assign({ questions: ({ event }) => event.questions }),
      },
      PLAN_VALIDATED: {
        target: 'reviewingPlan',
        actions: assign({ activeEffect: null, plan: ({ event }) => event.plan }),
      },
      INVALID_OUTPUT: { target: 'invalidPlan', actions: assign({ activeEffect: null }) },
      PERMISSION_REQUESTED: {
        target: 'awaitingPlanningApproval',
        actions: assign({ pendingApproval: ({ event }) => pendingApproval('planning', event) }),
      },
    },
  },
  applying: {
    on: {
      CANCEL_SETUP_REQUESTED: 'cancelling',
      EFFECT_INTENT_SAVED: { actions: assign({ activeEffect: ({ event }) => event.effect }) },
      APPLICATION_SESSION_STARTED: {
        actions: sessionStartedAction('application'),
      },
      APPLICATION_COMPLETED: {
        target: 'reviewingDiff',
        actions: assign({
          activeEffect: null,
          finalDiff: ({ event }) => event.finalDiff,
          progress: ({ event }) => event.progress,
        }),
      },
      APPLICATION_DRIFT: {
        target: 'reviewRequired',
        actions: assign({ activeEffect: null, recoveryMessage: ({ event }) => event.reason }),
      },
      INVALID_OUTPUT: { target: 'reviewingPlan', actions: assign({ activeEffect: null }) },
      PERMISSION_REQUESTED: {
        target: 'awaitingApplicationApproval',
        actions: assign({ pendingApproval: ({ event }) => pendingApproval('application', event) }),
      },
    },
  },
} satisfies ProjectSetupStates

type SessionStartedEvent = Extract<
  ProjectSetupEvent,
  { type: 'PLANNING_SESSION_STARTED' | 'APPLICATION_SESSION_STARTED' }
>

function sessionStartedAction<Event extends SessionStartedEvent>(
  effect: 'planning' | 'application',
): AssignAction<ProjectSetupContext, Event, undefined, ProjectSetupEvent, ProvidedActor> {
  return assign<ProjectSetupContext, Event, undefined, ProjectSetupEvent, ProvidedActor>({
    ...(effect === 'planning'
      ? { planningSessionId: ({ event }) => event.sessionId }
      : { applicationSessionId: ({ event }) => event.sessionId }),
    attemptEvidence: ({ context, event }) =>
      updateCurrentAttemptEvidence(context, sessionEvidence(event)),
  })
}

function sessionEvidence(
  event: Extract<
    ProjectSetupEvent,
    { type: 'PLANNING_SESSION_STARTED' | 'APPLICATION_SESSION_STARTED' }
  >,
) {
  return event.type === 'PLANNING_SESSION_STARTED'
    ? { planningSessionId: event.sessionId }
    : { applicationSessionId: event.sessionId }
}

function pendingApproval(
  effect: 'planning' | 'application',
  event: Extract<ProjectSetupEvent, { type: 'PERMISSION_REQUESTED' }>,
) {
  return { effect, permissionId: event.permissionId, description: event.description }
}
