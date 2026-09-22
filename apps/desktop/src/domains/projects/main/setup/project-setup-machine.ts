import { assertEvent, assign, sendTo, setup } from 'xstate'
import { inactiveProjectSetupActors } from '@/domains/projects/main/setup/actors/project-setup-actors'
import { projectSetupApplicationInput } from '@/domains/projects/main/setup/actors/project-setup-application-actor'
import { projectSetupCancellationInput } from '@/domains/projects/main/setup/actors/project-setup-cancellation-actor'
import { projectSetupPlanningInput } from '@/domains/projects/main/setup/actors/project-setup-planning-actor'
import {
  initialProjectSetupContext,
  type ProjectSetupContext,
  type ProjectSetupEvent,
} from './project-setup-machine-types'

export const PROJECT_SETUP_MACHINE_VERSION = 1

function updateCurrentAttemptEvidence(
  context: ProjectSetupContext,
  change: Partial<ProjectSetupContext['attemptEvidence'][number]>,
) {
  const attemptNumber = context.attemptNumber
  if (attemptNumber === null) return context.attemptEvidence
  return context.attemptEvidence.map((attempt) =>
    attempt.number === attemptNumber
      ? {
          ...attempt,
          ...change,
        }
      : attempt,
  )
}

const projectSetup = setup({
  types: {} as {
    context: ProjectSetupContext
    events: ProjectSetupEvent
    tags: 'agent-running' | 'busy' | 'permission-capable' | 'recoverable'
  },
  actors: inactiveProjectSetupActors,
  guards: {
    'if an approval is pending': ({ context }) => context.pendingApproval !== null,
  },
  actions: {
    interruptEffect: assign({
      activeEffect: null,
      pendingApproval: null,
      recoveryMessage: ({ event }) => {
        assertEvent(event, 'Effect interrupted')
        return event.reason
      },
    }),
    recordProgress: assign({
      progress: ({ event }) => {
        assertEvent(event, 'Progress received')
        return event.progress
      },
    }),
    beginAttempt: assign({
      applicationHarness: ({ event }) => {
        assertEvent(event, 'Choose agent')
        return event.harness
      },
      attemptNumber: ({ context }) => (context.attemptNumber ?? 0) + 1,
      attemptEvidence: ({ context, event }) => {
        assertEvent(event, 'Choose agent')
        return [
          ...context.attemptEvidence,
          {
            number: (context.attemptNumber ?? 0) + 1,
            planningHarness: event.harness,
            planningSessionId: null,
            applicationSessionId: null,
            acceptedPlanRevision: null,
          },
        ]
      },
      selectedHarness: ({ event }) => {
        assertEvent(event, 'Choose agent')
        return event.harness
      },
    }),
    beginPlanning: assign({
      activeEffect: 'planning',
    }),
    recordPlanningSession: assign({
      planningSessionId: ({ event }) => {
        assertEvent(event, 'Planning session started')
        return event.sessionId
      },
      attemptEvidence: ({ context, event }) => {
        assertEvent(event, 'Planning session started')
        return updateCurrentAttemptEvidence(context, {
          planningSessionId: event.sessionId,
        })
      },
    }),
    recordQuestions: assign({
      activeEffect: null,
      pendingApproval: null,
      questions: ({ event }) => {
        assertEvent(event, 'Questions received')
        return event.questions
      },
    }),
    recordPlan: assign({
      activeEffect: null,
      pendingApproval: null,
      plan: ({ event }) => {
        assertEvent(event, 'Plan validated')
        return event.plan
      },
    }),
    finishEffect: assign({
      activeEffect: null,
      pendingApproval: null,
    }),
    requestPermission: assign(
      (
        { event },
        params: {
          effect: 'planning' | 'application'
        },
      ) => {
        assertEvent(event, 'Permission requested')
        return {
          pendingApproval: {
            effect: params.effect,
            permissionId: event.permissionId,
            description: event.description,
          },
        }
      },
    ),
    forwardPlanningPermission: sendTo('onboardingPlanning', ({ event }) => event),
    forwardApplicationPermission: sendTo('onboardingApplication', ({ event }) => event),
    clearPermission: assign({
      pendingApproval: null,
    }),
    clearQuestions: assign({
      questions: [],
    }),
    recordApplicationHarness: assign({
      applicationHarness: ({ event }) => {
        assertEvent(event, 'Select application harness')
        return event.harness
      },
    }),
    acceptPlan: assign({
      acceptedPlan: ({ event }) => {
        assertEvent(event, 'Accept plan')
        return event.acceptedPlan
      },
      attemptEvidence: ({ context, event }) => {
        assertEvent(event, 'Accept plan')
        return updateCurrentAttemptEvidence(context, {
          acceptedPlanRevision: event.acceptedPlan.sourceRevision,
        })
      },
    }),
    beginApplication: assign({
      activeEffect: 'application',
    }),
    recordApplicationSession: assign({
      applicationSessionId: ({ event }) => {
        assertEvent(event, 'Application session started')
        return event.sessionId
      },
      attemptEvidence: ({ context, event }) => {
        assertEvent(event, 'Application session started')
        return updateCurrentAttemptEvidence(context, {
          applicationSessionId: event.sessionId,
        })
      },
    }),
    completeApplication: assign({
      activeEffect: null,
      pendingApproval: null,
      finalDiff: ({ event }) => {
        assertEvent(event, 'Application completed')
        return event.finalDiff
      },
      progress: ({ event }) => {
        assertEvent(event, 'Application completed')
        return event.progress
      },
    }),
    recordApplicationDrift: assign({
      activeEffect: null,
      pendingApproval: null,
      finalDiff: ({ event }) => {
        assertEvent(event, 'Application drift')
        return event.finalDiff
      },
      recoveryMessage: ({ event }) => {
        assertEvent(event, 'Application drift')
        return event.reason
      },
    }),
    clearRecoveryMessage: assign({
      recoveryMessage: null,
    }),
    restartAttempt: assign({
      applicationSessionId: null,
      finalDiff: null,
      plan: null,
      acceptedPlan: null,
      planningSessionId: null,
      progress: [],
      recoveryMessage: null,
    }),
    beginFinalization: assign({
      pendingFinalization: true,
    }),
    confirmCancellation: assign({
      activeEffect: null,
      recoveryMessage: 'cancelled',
    }),
    recordCancellationFailure: assign({
      recoveryMessage: ({ event }) => {
        assertEvent(event, 'Cancel setup failed')
        return event.reason
      },
    }),
    completeFinalization: assign({
      pendingFinalization: false,
    }),
    recordFinalizationFailure: assign({
      pendingFinalization: false,
      recoveryMessage: ({ event }) => {
        assertEvent(event, 'Finalization failed')
        return event.reason
      },
    }),
    saveManualSource: assign({
      manualSource: ({ event }) => {
        assertEvent(event, 'Save manual')
        return event.source
      },
    }),
  },
})

export const projectSetupMachine = projectSetup.createMachine({
  id: 'project-setup',
  initial: 'Choosing setup method',
  context: initialProjectSetupContext,
  states: {
    'Choosing setup method': {
      on: {
        'Choose manual': 'Manual setup',
        'Choose agent': {
          target: 'Planning',
          actions: 'beginAttempt',
        },
        Defer: 'Deferred',
      },
    },
    Planning: {
      tags: [
        'agent-running',
        'busy',
        'permission-capable',
      ],
      entry: 'beginPlanning',
      exit: 'clearPermission',
      invoke: {
        id: 'onboardingPlanning',
        src: 'onboardingPlanning',
        input: ({ context, event }) => projectSetupPlanningInput(context, event),
      },
      on: {
        'Effect interrupted': {
          target: 'Interrupted',
          actions: 'interruptEffect',
        },
        'Progress received': {
          actions: 'recordProgress',
        },
        'Cancel setup requested': 'Cancelling',
        'Planning session started': {
          actions: 'recordPlanningSession',
        },
        'Questions received': {
          target: 'Questions',
          actions: 'recordQuestions',
        },
        'Plan validated': {
          target: 'Reviewing plan',
          actions: 'recordPlan',
        },
        'Invalid output': {
          target: 'Planning',
        },
        'Permission requested': {
          actions: {
            type: 'requestPermission',
            params: {
              effect: 'planning',
            },
          },
        },
        'Approve effect': {
          guard: 'if an approval is pending',
          actions: [
            'forwardPlanningPermission',
            'clearPermission',
          ],
        },
        'Reject effect': {
          guard: 'if an approval is pending',
          actions: [
            'forwardPlanningPermission',
            'clearPermission',
          ],
        },
      },
    },
    Questions: {
      on: {
        'Answers sent': {
          target: 'Planning',
          actions: 'clearQuestions',
        },
      },
    },
    'Reviewing plan': {
      on: {
        'Request plan change': 'Planning',
        'Continue plan review': 'Customizing Project setup',
      },
    },
    'Customizing Project setup': {
      on: {
        Back: 'Reviewing plan',
        'Request plan change': 'Planning',
        'Select application harness': {
          actions: 'recordApplicationHarness',
        },
        'Accept plan': {
          target: 'Applying',
          actions: 'acceptPlan',
        },
      },
    },
    Applying: {
      tags: [
        'agent-running',
        'busy',
        'permission-capable',
      ],
      entry: 'beginApplication',
      exit: 'clearPermission',
      invoke: {
        id: 'onboardingApplication',
        src: 'onboardingApplication',
        input: ({ context, event }) => projectSetupApplicationInput(context, event),
      },
      on: {
        'Effect interrupted': {
          target: 'Interrupted',
          actions: 'interruptEffect',
        },
        'Progress received': {
          actions: 'recordProgress',
        },
        'Cancel setup requested': 'Cancelling',
        'Application session started': {
          actions: 'recordApplicationSession',
        },
        'Application completed': {
          target: 'Reviewing changes',
          actions: 'completeApplication',
        },
        'Application drift': {
          target: 'Review required',
          actions: 'recordApplicationDrift',
        },
        'Invalid output': {
          target: 'Reviewing plan',
          actions: 'finishEffect',
        },
        'Permission requested': {
          actions: {
            type: 'requestPermission',
            params: {
              effect: 'application',
            },
          },
        },
        'Approve effect': {
          guard: 'if an approval is pending',
          actions: [
            'forwardApplicationPermission',
            'clearPermission',
          ],
        },
        'Reject effect': {
          guard: 'if an approval is pending',
          actions: [
            'forwardApplicationPermission',
            'clearPermission',
          ],
        },
      },
    },
    'Review required': {
      on: {
        'Request plan change': 'Planning',
      },
    },
    Interrupted: {
      tags: 'recoverable',
      on: {
        'Resume planning': {
          target: 'Planning',
          actions: 'clearRecoveryMessage',
        },
        'Resume application': {
          target: 'Applying',
          actions: 'clearRecoveryMessage',
        },
        'Restart attempt': {
          target: 'Choosing setup method',
          actions: 'restartAttempt',
        },
      },
    },
    'Reviewing changes': {
      on: {
        'Approve final diff': {
          target: 'Finalizing',
          actions: 'beginFinalization',
        },
        'Request application change': {
          target: 'Applying',
        },
      },
    },
    Cancelling: {
      tags: 'busy',
      invoke: {
        id: 'cancellation',
        src: 'cancellation',
        input: ({ context }) => projectSetupCancellationInput(context),
      },
      on: {
        'Cancel setup confirmed': {
          target: 'Interrupted',
          actions: 'confirmCancellation',
        },
        'Cancel setup failed': {
          target: 'Cancel failed',
          actions: 'recordCancellationFailure',
        },
      },
    },
    'Cancel failed': {
      tags: 'recoverable',
      on: {
        'Retry cancel': 'Cancelling',
      },
    },
    Finalizing: {
      tags: 'busy',
      invoke: {
        id: 'finalization',
        src: 'finalization',
      },
      on: {
        'Finalization completed': {
          target: 'Ready',
          actions: 'completeFinalization',
        },
        'Finalization failed': {
          target: 'Reviewing changes',
          actions: 'recordFinalizationFailure',
        },
      },
    },
    'Manual setup': {
      on: {
        Back: 'Choosing setup method',
        Defer: 'Deferred',
        'Save manual': {
          target: 'Ready',
          actions: 'saveManualSource',
        },
      },
    },
    Deferred: {
      on: {
        'Resume setup': 'Choosing setup method',
      },
    },
    Ready: {
      on: {
        'Edit setup': 'Choosing setup method',
      },
    },
  },
})
