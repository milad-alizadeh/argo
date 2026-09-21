import { assign, createMachine } from 'xstate'
import { updateCurrentAttemptEvidence } from './project-setup-attempt-evidence'
import { projectSetupFinalizationState } from './project-setup-machine-finalization-state'
import { projectSetupRunningStates } from './project-setup-machine-running-states'
import {
  initialProjectSetupContext,
  type ProjectSetupContext,
  type ProjectSetupEvent,
} from './project-setup-machine-types'
import { projectSetupTerminalStates } from './project-setup-terminal-states'
export const PROJECT_SETUP_MACHINE_VERSION = 1

export const projectSetupMachine = createMachine({
  types: {} as { context: ProjectSetupContext; events: ProjectSetupEvent },
  id: 'project-setup',
  initial: 'choosingMethod',
  context: initialProjectSetupContext,
  on: {
    EFFECT_INTERRUPTED: {
      target: '.interrupted',
      actions: assign({
        activeEffect: null,
        pendingApproval: null,
        recoveryMessage: ({ event }) => event.reason,
      }),
    },
    PROGRESS_RECEIVED: { actions: assign({ progress: ({ event }) => event.progress }) },
  },
  states: {
    choosingMethod: {
      on: {
        CHOOSE_MANUAL: 'manual',
        CHOOSE_AGENT: {
          target: 'preflight',
          actions: assign({
            applicationHarness: ({ event }) => event.harness,
            attemptNumber: ({ context }) => (context.attemptNumber ?? 0) + 1,
            attemptEvidence: ({ context, event }) => [
              ...context.attemptEvidence,
              {
                number: (context.attemptNumber ?? 0) + 1,
                planningHarness: event.harness,
                planningSessionId: null,
                applicationSessionId: null,
                acceptedPlanRevision: null,
              },
            ],
            selectedHarness: ({ event }) => event.harness,
          }),
        },
        DEFER: 'deferred',
      },
    },
    preflight: { on: { PREFLIGHT_PASSED: 'planning', PREFLIGHT_FAILED: 'planningUnavailable' } },
    planningUnavailable: {
      on: {
        RETRY_PREFLIGHT: 'preflight',
        CHOOSE_MANUAL: 'manual',
        DEFER: 'deferred',
      },
    },
    questions: { on: { ANSWERS_SENT: { target: 'planning', actions: assign({ questions: [] }) } } },
    reviewingPlan: {
      on: {
        REQUEST_PLAN_CHANGE: 'planning',
        CHOOSE_APPLICATION_HARNESS: {
          actions: assign({ applicationHarness: ({ event }) => event.harness }),
        },
        ACCEPT_PLAN: {
          target: 'applying',
          actions: assign({
            acceptedPlan: ({ event }) => event.acceptedPlan,
            attemptEvidence: ({ context, event }) =>
              updateCurrentAttemptEvidence(context, {
                acceptedPlanRevision: event.acceptedPlan.sourceRevision,
              }),
          }),
        },
      },
    },
    invalidPlan: { on: { REQUEST_PLAN_CHANGE: 'planning' } },
    reviewRequired: { on: { REQUEST_PLAN_CHANGE: 'planning' } },
    interrupted: {
      on: {
        RESUME_PLANNING: { target: 'planning', actions: assign({ recoveryMessage: null }) },
        RESUME_APPLICATION: { target: 'applying', actions: assign({ recoveryMessage: null }) },
        RESTART_ATTEMPT: {
          target: 'choosingMethod',
          actions: assign({
            applicationSessionId: null,
            finalDiff: null,
            plan: null,
            acceptedPlan: null,
            planningSessionId: null,
            progress: [],
            recoveryMessage: null,
          }),
        },
      },
    },
    reviewingDiff: {
      on: {
        APPROVE_FINAL_DIFF: {
          target: 'finalizing',
          actions: assign({ pendingFinalization: true }),
        },
        REJECT_FINAL_DIFF: {
          target: 'reviewingPlan',
          actions: assign({
            applicationSessionId: null,
            finalDiff: null,
            acceptedPlan: null,
            progress: [],
          }),
        },
      },
    },
    cancelling: {
      on: {
        CANCEL_SETUP_CONFIRMED: {
          target: 'interrupted',
          actions: assign({
            activeEffect: null,
            recoveryMessage: 'The active Project setup Session was cancelled.',
          }),
        },
        CANCEL_SETUP_FAILED: {
          target: 'cancelFailed',
          actions: assign({ recoveryMessage: ({ event }) => event.reason }),
        },
      },
    },
    cancelFailed: { on: { RETRY_CANCEL: 'cancelling' } },
    awaitingPlanningApproval: {
      on: {
        APPROVE_EFFECT: { target: 'planning', actions: assign({ pendingApproval: null }) },
        REJECT_EFFECT: { target: 'reviewingPlan', actions: assign({ pendingApproval: null }) },
      },
    },
    awaitingApplicationApproval: {
      on: {
        APPROVE_EFFECT: { target: 'applying', actions: assign({ pendingApproval: null }) },
        REJECT_EFFECT: { target: 'reviewingPlan', actions: assign({ pendingApproval: null }) },
      },
    },
    ...projectSetupFinalizationState,
    ...projectSetupRunningStates,
    ...projectSetupTerminalStates,
  },
})
