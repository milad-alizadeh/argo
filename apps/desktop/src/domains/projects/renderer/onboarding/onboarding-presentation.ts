import type { ProjectSetupHarnessAvailability } from './model/project-setup-harness'
import type { ProjectSetupAnswer, ProjectSetupQuestion } from './model/project-setup-question'
import type { ProjectSetupRecoveryCode } from './model/project-setup-recovery'
import type { ProjectSetupScreen } from './model/project-setup-screen'
import type { AcceptedSetupPlan, SetupPlan } from './model/setup-plan'
import type { SetupStepStatus } from './model/setup-progress'

export type OnboardingProject = {
  id: string
  name: string
  path: string
}

export type ProjectSetupCommand =
  | { type: 'choose-manual' }
  | { type: 'choose-agent'; harness: 'claude' | 'codex' }
  | { type: 'answer-questions'; answers: ProjectSetupAnswer[] }
  | { type: 'request-plan-change'; feedback: string }
  | { type: 'continue-plan-review' }
  | { type: 'accept-plan'; acceptedPlan: AcceptedSetupPlan }
  | { type: 'choose-application-harness'; harness: 'claude' | 'codex' }
  | { type: 'approve-final-diff' }
  | { type: 'request-application-change'; feedback: string }
  | { type: 'cancel-setup' }
  | { type: 'retry-cancel' }
  | { type: 'approve-effect' }
  | { type: 'reject-effect' }
  | { type: 'resume-planning' }
  | { type: 'resume-application' }
  | { type: 'restart-attempt' }
  | { type: 'defer' }
  | { type: 'back' }
  | { type: 'save-manual'; source: string }
  | { type: 'resume-setup' }
  | { type: 'edit-setup' }

export type ProjectSetupSnapshot = {
  projectId: string
  revision: number
  harnesses?: ProjectSetupHarnessAvailability[]
  screen: ProjectSetupScreen
  manualSource: string
  attempt: {
    number: number
    planningHarness: 'claude' | 'codex'
    applicationHarness: 'claude' | 'codex' | null
    planningSessionId: string | null
    applicationSessionId: string | null
  } | null
  questions: ProjectSetupQuestion[]
  plan: SetupPlan | null
  acceptedPlan: AcceptedSetupPlan | null
  progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>
  finalDiff: string | null
  activeEffect: 'planning' | 'application' | null
  recoveryMessage: ProjectSetupRecoveryCode | null
  pendingApproval: {
    effect: 'planning' | 'application'
    permissionId: string
    description: string
  } | null
}
