// The #2381 canonical onboarding agent contract, as a Zod schema. A planning agent produces a
// setupPlanningResult; Argo validates it before render. See the parent issue's "Canonical
// onboarding agent contract" comment for the prose this schema encodes.

import { z } from 'zod'
import { identifierSchema } from '../../../shared/validation'
import { validateSetupPlan } from './setup-plan-validation'

const capabilityDispositionSchema = z.enum(['recommended', 'optional', 'not-applicable', 'already-satisfied'])

const planSourceSchema = z.object({
  projectId: identifierSchema,
  projectRoot: z.string().min(1),
  skillRevision: z.string().min(1),
  planRevision: z.string().min(1),
  fingerprints: z.record(z.string().min(1), z.string().min(1)),
})

const inventorySchema = z.object({
  instructions: z.array(z.string()),
  manifests: z.array(z.string()),
  packageManagers: z.array(z.string()),
  workspaces: z.array(z.string()),
  existingTools: z.array(z.string()),
  currentConfiguration: z.record(z.string(), z.unknown()),
})

const targetCommandsSchema = z.object({
  setup: z.string().optional(),
  run: z.string().optional(),
  build: z.string().optional(),
  test: z.string().optional(),
  componentExplorer: z.string().optional(),
})

const targetSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  path: z.string().min(1),
  isDefault: z.boolean(),
  evidence: z.string().min(1),
  packageManager: z.string().optional(),
  framework: z.string().optional(),
  commands: targetCommandsSchema,
  readinessRule: z.string().optional(),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
})

const capabilityEffectsSchema = z.object({
  files: z.array(z.string()),
  dependencies: z.array(z.string()),
  generatedFiles: z.array(z.string()),
  machineWide: z.boolean(),
})

const capabilityConsentSchema = z.object({
  required: z.boolean(),
  personalOrMachineWide: z.boolean(),
})

const capabilityApplicationStepSchema = z.object({
  id: identifierSchema,
  description: z.string().min(1),
  prerequisiteIds: z.array(identifierSchema),
})

const capabilitySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  scope: z.enum(['repository', 'target']),
  targetIds: z.array(identifierSchema),
  disposition: capabilityDispositionSchema,
  evidence: z.string().min(1),
  reason: z.string().min(1),
  effects: capabilityEffectsSchema,
  consent: capabilityConsentSchema,
  applicationSteps: z.array(capabilityApplicationStepSchema),
})

const toolRecommendationSchema = z.object({
  id: identifierSchema,
  scope: z.enum(['repository', 'target']),
  targetIds: z.array(identifierSchema),
  recommendedChoice: z.string().min(1),
  // A remote URL, never a bundled asset: the planning agent cannot ship image bytes, only point
  // at the tool's own hosted logo.
  iconUrl: z.url().optional(),
  packageNames: z.array(z.string()),
  links: z.array(z.url()),
  alternatives: z.array(z.string()),
  reason: z.string().min(1),
  dependencyChanges: z.array(z.string()),
  fileEffects: z.array(z.string()),
  recommendationVersion: z.string().min(1),
})

const actionSchema = z.object({
  id: identifierSchema,
  scope: z.enum(['repository', 'target']),
  reason: z.string().min(1),
  evidence: z.string().min(1),
  fileCategories: z.array(z.string()),
  command: z.string().optional(),
  prerequisiteIds: z.array(identifierSchema),
  rollbackNote: z.string().optional(),
})

const repositoryActionSchema = actionSchema.extend({ scope: z.literal('repository') })
const targetActionSchema = actionSchema.extend({ scope: z.literal('target'), targetId: identifierSchema })

const verificationStepSchema = z.object({
  id: identifierSchema,
  targetId: identifierSchema,
  capabilityId: identifierSchema.optional(),
  command: z.string().optional(),
  readinessRule: z.string().optional(),
  prerequisiteIds: z.array(identifierSchema),
  expectedResult: z.string().min(1),
  timeoutSeconds: z.number().int().positive(),
  required: z.boolean(),
})

const riskSchema = z.object({
  id: identifierSchema,
  kind: z.enum(['assumption', 'uncertain-merge', 'destructive', 'secret-boundary', 'machine-wide']),
  description: z.string().min(1),
})

const handoffSchema = z.object({
  mutationBoundary: z.string().min(1),
  acceptanceState: z.enum(['pending-review', 'accepted']),
  applicationOrder: z.array(identifierSchema),
})

export const setupPlanSchema = z
  .object({
    source: planSourceSchema,
    inventory: inventorySchema,
    targets: z.array(targetSchema),
    capabilities: z.array(capabilitySchema),
    toolRecommendations: z.array(toolRecommendationSchema),
    repositoryActions: z.array(repositoryActionSchema),
    targetActions: z.array(targetActionSchema),
    verification: z.array(verificationStepSchema),
    risks: z.array(riskSchema),
    handoff: handoffSchema,
  })
  .superRefine(validateSetupPlan)

export type SetupPlan = z.infer<typeof setupPlanSchema>

const questionSchema = z.object({
  id: identifierSchema,
  prompt: z.string().min(1),
  context: z.string().optional(),
})

const cannotPlanReasonSchema = z.enum([
  'inaccessible-project',
  'ambiguous-boundary',
  'unsupported-workspace',
  'skill-unavailable',
])

export const setupPlanningResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('needs-user-input'),
    revision: z.string().min(1),
    questions: z.array(questionSchema).min(1),
  }),
  z.object({
    status: z.literal('ready-for-review'),
    revision: z.string().min(1),
    plan: setupPlanSchema,
  }),
  z.object({
    status: z.literal('cannot-plan'),
    revision: z.string().min(1),
    reason: cannotPlanReasonSchema,
    evidence: z.string().min(1),
    recoveryAction: z.string().min(1),
  }),
])

export type SetupPlanningResult = z.infer<typeof setupPlanningResultSchema>

export function parseSetupPlanningResult(value: unknown): SetupPlanningResult {
  return setupPlanningResultSchema.parse(value)
}

export const acceptedSetupPlanSchema = z
  .object({
    sourceRevision: z.string().min(1),
    projectRoot: z.string().min(1),
    fingerprints: z.record(z.string().min(1), z.string().min(1)),
    targets: z.array(targetSchema),
    capabilities: z.array(capabilitySchema.omit({ disposition: true })),
    toolRecommendations: z.array(toolRecommendationSchema),
    repositoryActions: z.array(repositoryActionSchema),
    targetActions: z.array(targetActionSchema),
    verification: z.array(verificationStepSchema),
    handoff: handoffSchema,
  })
  .superRefine((accepted, context) =>
    validateSetupPlan(
      {
        ...accepted,
        source: {
          projectId: '_',
          projectRoot: accepted.projectRoot,
          skillRevision: '_',
          planRevision: accepted.sourceRevision,
          fingerprints: accepted.fingerprints,
        },
        inventory: {
          instructions: [],
          manifests: [],
          packageManagers: [],
          workspaces: [],
          existingTools: [],
          currentConfiguration: {},
        },
        capabilities: accepted.capabilities.map((capability) => ({
          ...capability,
          disposition: 'recommended' as const,
        })),
        risks: [],
      },
      context,
    ),
  )

export type AcceptedSetupPlan = z.infer<typeof acceptedSetupPlanSchema>

export function parseAcceptedSetupPlan(value: unknown): AcceptedSetupPlan {
  return acceptedSetupPlanSchema.parse(value)
}

export interface AcceptedPlanValidationOutcome {
  valid: boolean
  issues: string[]
}

/** Proves an accepted plan derives from the reviewed source plan (#2381 acceptance rule). */
export function validateAcceptedSetupPlan(
  sourcePlan: SetupPlan,
  acceptedPlan: AcceptedSetupPlan,
): AcceptedPlanValidationOutcome {
  const issues: string[] = []

  if (acceptedPlan.sourceRevision !== sourcePlan.source.planRevision) {
    issues.push(
      `Accepted plan revision "${acceptedPlan.sourceRevision}" does not match source revision "${sourcePlan.source.planRevision}".`,
    )
  }
  if (acceptedPlan.projectRoot !== sourcePlan.source.projectRoot) {
    issues.push('Accepted plan project root does not match the source plan.')
  }
  for (const [path, hash] of Object.entries(acceptedPlan.fingerprints)) {
    if (sourcePlan.source.fingerprints[path] !== hash) {
      issues.push(`Fingerprint for "${path}" does not match the source plan.`)
    }
  }

  const sourceIds = {
    targets: new Set(sourcePlan.targets.map((target) => target.id)),
    capabilities: new Set(sourcePlan.capabilities.map((capability) => capability.id)),
    toolRecommendations: new Set(sourcePlan.toolRecommendations.map((recommendation) => recommendation.id)),
    repositoryActions: new Set(sourcePlan.repositoryActions.map((action) => action.id)),
    targetActions: new Set(sourcePlan.targetActions.map((action) => action.id)),
    verification: new Set(sourcePlan.verification.map((step) => step.id)),
  }

  const boundedCollections: Array<[string, { id: string }[], Set<string>]> = [
    ['targets', acceptedPlan.targets, sourceIds.targets],
    ['capabilities', acceptedPlan.capabilities, sourceIds.capabilities],
    ['toolRecommendations', acceptedPlan.toolRecommendations, sourceIds.toolRecommendations],
    ['repositoryActions', acceptedPlan.repositoryActions, sourceIds.repositoryActions],
    ['targetActions', acceptedPlan.targetActions, sourceIds.targetActions],
    ['verification', acceptedPlan.verification, sourceIds.verification],
  ]
  for (const [name, items, allowed] of boundedCollections) {
    for (const item of items) {
      if (!allowed.has(item.id)) {
        issues.push(`Accepted ${name} entry "${item.id}" is not present in the reviewed source plan.`)
      }
    }
  }

  return { valid: issues.length === 0, issues }
}
