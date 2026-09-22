// Re-exports for the setup folder - the one concern that the setup flow contains
export {
  projectSetupEffectSchema,
  projectSetupPendingApprovalSchema,
} from './project-setup-approval'

export {
  projectSetupHarnesses,
  defaultProjectSetupHarnesses,
  type ProjectSetupHarness,
  type ProjectSetupHarnessAvailability,
} from './project-setup-harness'

export {
  projectSetupQuestionSchema,
  projectSetupAnswerSchema,
  type ProjectSetupQuestion,
  type ProjectSetupAnswer,
} from './project-setup-question'

export {
  PROJECT_SETUP_RECOVERY_CODES,
  projectSetupRecoveryCodeSchema,
  type ProjectSetupRecoveryCode,
} from './project-setup-recovery'

export { projectSetupScreenSchema } from './project-setup-screen'

export {
  type SetupAnswers,
  setupAnswers,
  setupConfiguration,
} from './setup-configuration'

export {
  setupLocale,
  setupFieldText,
  setupPlanText,
  setupChoiceText,
} from './setup-document-text'

export {
  SETUP_RENDERER_CAPABILITIES,
  validateSetupDocument,
} from './setup-document-validation'

export {
  setupFieldSchema,
  setupDocumentSchema,
  parseSetupDocument,
  type SetupField,
  type SetupDocument,
} from './setup-document'

export { findsCycle } from './setup-plan-cycle'

export {
  handoffSchema,
  setupPlanSchema,
  acceptedSetupPlanSchema,
} from './setup-plan-schema'

export {
  type SetupPlan,
  type AcceptedSetupPlan,
} from './setup-plan-types'

export {
  validateIdentifiers,
  validateTargetReferences,
  validateDefaultTargets,
  validatePrerequisites,
} from './setup-plan-validation-rules'

export {
  validateSetupPlan,
  validatePlanRevision,
  type PlanValidationOutcome,
} from './setup-plan-validation'

export {
  setupPlanningResultSchema,
  parseSetupPlanningResult,
  parseAcceptedSetupPlan,
  validateAcceptedSetupPlan,
  type SetupPlanningResult,
  type AcceptedPlanValidationOutcome,
} from './setup-plan'

export {
  setupStepStatusSchema,
  setupPlanningProgressEventSchema,
  setupApplicationProgressEventSchema,
  parseSetupPlanningProgressEvent,
  parseSetupApplicationProgressEvent,
  type SetupStepStatus,
  type SetupPlanningProgressEvent,
  type SetupApplicationProgressEvent,
} from './setup-progress'
