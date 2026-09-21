import type {
  ProjectSetupAnswer,
  ProjectSetupQuestion,
} from '@/domains/projects/contract/project-setup-question'
import type { ProjectSetupRecoveryCode } from '@/domains/projects/contract/project-setup-recovery'
import type { AcceptedSetupPlan, SetupPlan } from '@/domains/projects/contract/setup-plan'
import type { SetupStepStatus } from '@/domains/projects/contract/setup-progress'

export type ProjectSetupEvent =
  | { type: 'Choose manual' }
  | { type: 'Choose agent'; harness: 'claude' | 'codex' }
  | { type: 'Planning session started'; sessionId: string }
  | { type: 'Questions received'; questions: ProjectSetupQuestion[] }
  | { type: 'Answers sent'; answers: ProjectSetupAnswer[] }
  | { type: 'Plan validated'; plan: SetupPlan }
  | { type: 'Invalid output'; issues: string[] }
  | { type: 'Request plan change'; feedback: string }
  | { type: 'Continue plan review' }
  | { type: 'Select application harness'; harness: 'claude' | 'codex' }
  | { type: 'Accept plan'; acceptedPlan: AcceptedSetupPlan }
  | { type: 'Application session started'; sessionId: string }
  | {
      type: 'Progress received'
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
    }
  | {
      type: 'Application completed'
      finalDiff: string
      progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
    }
  | { type: 'Application drift'; reason: ProjectSetupRecoveryCode; finalDiff: string }
  | { type: 'Effect interrupted'; reason: ProjectSetupRecoveryCode }
  | { type: 'Resume planning' }
  | { type: 'Resume application' }
  | { type: 'Restart attempt' }
  | { type: 'Defer' }
  | { type: 'Back' }
  | { type: 'Save manual'; source: string }
  | { type: 'Resume setup' }
  | { type: 'Edit setup' }
  | { type: 'Approve final diff' }
  | { type: 'Request application change'; feedback: string }
  | { type: 'Cancel setup requested' }
  | { type: 'Retry cancel' }
  | { type: 'Permission requested'; permissionId: string; description: string }
  | { type: 'Approve effect' }
  | { type: 'Reject effect' }
  | { type: 'Cancel setup confirmed' }
  | { type: 'Cancel setup failed'; reason: ProjectSetupRecoveryCode }
  | { type: 'Finalization completed' }
  | { type: 'Finalization failed'; reason: ProjectSetupRecoveryCode }

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
  questions: ProjectSetupQuestion[]
  plan: SetupPlan | null
  acceptedPlan: AcceptedSetupPlan | null
  progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
  finalDiff: string | null
  activeEffect: 'planning' | 'application' | null
  recoveryMessage: ProjectSetupRecoveryCode | null
  pendingFinalization: boolean
  pendingApproval: {
    effect: 'planning' | 'application'
    permissionId: string
    description: string
  } | null
}

export function initialProjectSetupContext(): ProjectSetupContext {
  return {
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
  }
}
