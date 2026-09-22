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
  setupLocale,
  setupFieldText,
  setupPlanText,
  setupChoiceText,
  SETUP_RENDERER_CAPABILITIES,
  validateSetupDocument,
  setupFieldSchema,
  setupDocumentSchema,
  parseSetupDocument,
  type SetupField,
  type SetupDocument,
} from './setup-document'

export {
  findsCycle,
  handoffSchema,
  setupPlanSchema,
  acceptedSetupPlanSchema,
  type SetupPlan,
  type AcceptedSetupPlan,
  validateIdentifiers,
  validateTargetReferences,
  validateDefaultTargets,
  validatePrerequisites,
  validateSetupPlan,
  validatePlanRevision,
  type PlanValidationOutcome,
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
