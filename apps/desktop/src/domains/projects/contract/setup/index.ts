// Re-exports for the setup folder - the one concern that the setup flow contains
export {
  projectSetupEffectSchema,
  projectSetupPendingApprovalSchema,
} from './project-setup-approval'

export {
  defaultProjectSetupHarnesses,
  type ProjectSetupHarness,
  type ProjectSetupHarnessAvailability,
  projectSetupHarnesses,
} from './project-setup-harness'

export {
  type ProjectSetupAnswer,
  type ProjectSetupQuestion,
  projectSetupAnswerSchema,
  projectSetupQuestionSchema,
} from './project-setup-question'

export {
  PROJECT_SETUP_RECOVERY_CODES,
  type ProjectSetupRecoveryCode,
  projectSetupRecoveryCodeSchema,
} from './project-setup-recovery'

export { projectSetupScreenSchema } from './project-setup-screen'

export {
  parseSetupDocument,
  SETUP_RENDERER_CAPABILITIES,
  type SetupAnswers,
  type SetupDocument,
  type SetupField,
  setupAnswers,
  setupChoiceText,
  setupConfiguration,
  setupDocumentSchema,
  setupFieldSchema,
  setupFieldText,
  setupLocale,
  setupPlanText,
  validateSetupDocument,
} from './setup-document'

export {
  type AcceptedPlanValidationOutcome,
  type AcceptedSetupPlan,
  acceptedSetupPlanSchema,
  findsCycle,
  handoffSchema,
  type PlanValidationOutcome,
  parseAcceptedSetupPlan,
  parseSetupPlanningResult,
  type SetupPlan,
  type SetupPlanningResult,
  setupPlanningResultSchema,
  setupPlanSchema,
  validateAcceptedSetupPlan,
  validateDefaultTargets,
  validateIdentifiers,
  validatePlanRevision,
  validatePrerequisites,
  validateSetupPlan,
  validateTargetReferences,
} from './setup-plan'

export {
  parseSetupApplicationProgressEvent,
  parseSetupPlanningProgressEvent,
  type SetupApplicationProgressEvent,
  type SetupPlanningProgressEvent,
  type SetupStepStatus,
  setupApplicationProgressEventSchema,
  setupPlanningProgressEventSchema,
  setupStepStatusSchema,
} from './setup-progress'
