import { z } from 'zod'
import { identifierSchema } from '../../../shared/validation'
import { validateSetupPlan } from './setup-plan-validation'

const capabilityDispositionSchema = z.enum([
  'recommended',
  'optional',
  'not-applicable',
  'already-satisfied',
])

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

const capabilitySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  scope: z.enum(['repository', 'target']),
  targetIds: z.array(identifierSchema),
  disposition: capabilityDispositionSchema,
  evidence: z.string().min(1),
  reason: z.string().min(1),
  effects: z.object({
    files: z.array(z.string()),
    dependencies: z.array(z.string()),
    generatedFiles: z.array(z.string()),
    machineWide: z.boolean(),
  }),
  consent: z.object({ required: z.boolean(), personalOrMachineWide: z.boolean() }),
  applicationSteps: z.array(
    z.object({
      id: identifierSchema,
      description: z.string().min(1),
      prerequisiteIds: z.array(identifierSchema),
    }),
  ),
})

const toolRecommendationSchema = z.object({
  id: identifierSchema,
  scope: z.enum(['repository', 'target']),
  targetIds: z.array(identifierSchema),
  recommendedChoice: z.string().min(1),
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
const targetActionSchema = actionSchema.extend({
  scope: z.literal('target'),
  targetId: identifierSchema,
})

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

export const handoffSchema = z.object({
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
    risks: z.array(
      z.object({
        id: identifierSchema,
        kind: z.enum([
          'assumption',
          'uncertain-merge',
          'destructive',
          'secret-boundary',
          'machine-wide',
        ]),
        description: z.string().min(1),
      }),
    ),
    handoff: handoffSchema,
  })
  .superRefine(validateSetupPlan)

export const acceptedSetupPlanSchema = z.object({
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
