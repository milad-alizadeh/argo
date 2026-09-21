import type { AcceptedSetupPlan, SetupPlan } from '@/domains/projects/contract/setup-plan'
import type { SetupStepStatus } from '@/domains/projects/contract/setup-progress'

export type ProjectSetupEvent =
  | { type: 'CHOOSE_MANUAL' }
  | { type: 'CHOOSE_AGENT'; harness: 'claude' | 'codex' }
  | { type: 'PREFLIGHT_PASSED' }
  | { type: 'PLANNING_SESSION_STARTED'; sessionId: string }
  | { type: 'PREFLIGHT_FAILED' }
  | { type: 'RETRY_PREFLIGHT' }
  | { type: 'QUESTIONS_RECEIVED'; questions: Array<{ id: string; prompt: string }> }
  | { type: 'ANSWERS_SENT' }
  | { type: 'PLAN_VALIDATED'; plan: SetupPlan }
  | { type: 'INVALID_OUTPUT' }
  | { type: 'REQUEST_PLAN_CHANGE' }
  | { type: 'CHOOSE_APPLICATION_HARNESS'; harness: 'claude' | 'codex' }
  | { type: 'ACCEPT_PLAN'; acceptedPlan: AcceptedSetupPlan }
  | { type: 'APPLICATION_SESSION_STARTED'; sessionId: string }
  | {
      type: 'PROGRESS_RECEIVED'
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
    }
  | {
      type: 'APPLICATION_COMPLETED'
      finalDiff: string
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
    }
  | { type: 'APPLICATION_DRIFT'; reason: string }
  | { type: 'EFFECT_INTENT_SAVED'; effect: 'planning' | 'application' }
  | { type: 'EFFECT_INTERRUPTED'; reason: string }
  | { type: 'RESUME_PLANNING' }
  | { type: 'RESUME_APPLICATION' }
  | { type: 'RESTART_ATTEMPT' }
  | { type: 'DEFER' }
  | { type: 'BACK' }
  | { type: 'SAVE_MANUAL'; source: string }
  | { type: 'RESUME_SETUP' }
  | { type: 'START_REPAIR_OR_UPGRADE' }
  | { type: 'APPROVE_FINAL_DIFF' }
  | { type: 'REJECT_FINAL_DIFF' }
  | { type: 'CANCEL_SETUP_REQUESTED' }
  | { type: 'RETRY_CANCEL' }
  | { type: 'PERMISSION_REQUESTED'; permissionId: string; description: string }
  | { type: 'APPROVE_EFFECT' }
  | { type: 'REJECT_EFFECT' }
  | { type: 'CANCEL_SETUP_CONFIRMED' }
  | { type: 'CANCEL_SETUP_FAILED'; reason: string }
  | { type: 'FINALIZATION_COMPLETED' }
  | { type: 'FINALIZATION_FAILED'; reason: string }

export type ProjectSetupContext = {
  manualSource: string
  selectedHarness: 'claude' | 'codex' | null
  applicationHarness: 'claude' | 'codex' | null
  attemptNumber: number | null
  attemptEvidence: Array<{
    number: number
    planningHarness: 'claude' | 'codex'
    planningSessionId: string | null
    applicationSessionId: string | null
    acceptedPlanRevision: string | null
  }>
  planningSessionId: string | null
  applicationSessionId: string | null
  questions: Array<{ id: string; prompt: string }>
  plan: SetupPlan | null
  acceptedPlan: AcceptedSetupPlan | null
  progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
  finalDiff: string | null
  activeEffect: 'planning' | 'application' | null
  recoveryMessage: string | null
  pendingFinalization: boolean
  pendingApproval: {
    effect: 'planning' | 'application'
    permissionId: string
    description: string
  } | null
}

export const initialProjectSetupContext = {
  manualSource: '',
  selectedHarness: null,
  applicationHarness: null,
  attemptNumber: null,
  attemptEvidence: [],
  planningSessionId: null,
  applicationSessionId: null,
  questions: [],
  plan: null,
  acceptedPlan: null,
  progress: [],
  finalDiff: null,
  activeEffect: null,
  recoveryMessage: null,
  pendingFinalization: false,
  pendingApproval: null,
} satisfies ProjectSetupContext
