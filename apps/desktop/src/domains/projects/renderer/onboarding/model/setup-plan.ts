// The #2381 canonical onboarding agent contract: schema, cycle detection and both validation
// passes (structural rules and the accepted-plan derivation rule) for one concept, "is this
// plan valid" - split across five files only to stay under the removed 150-line cap.

import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { projectSetupQuestionSchema } from './project-setup-question'

export function findsCycle(
  ids: Set<string>,
  prerequisitesOf: Map<string, string[]>,
): string | null {
  const state = new Map<string, 'visiting' | 'done'>()
  for (const id of ids) {
    const cycle = visitCycle({ id, path: [], state, prerequisitesOf })
    if (cycle) return cycle
  }
  return null
}

function visitCycle({
  id,
  path,
  state,
  prerequisitesOf,
}: {
  id: string
  path: string[]
  state: Map<string, 'visiting' | 'done'>
  prerequisitesOf: Map<string, string[]>
}): string | null {
  const status = state.get(id)
  if (status === 'done') return null
  if (status === 'visiting') return [...path, id].join(' -> ')
  state.set(id, 'visiting')
  for (const prerequisite of prerequisitesOf.get(id) ?? []) {
    const cycle = visitCycle({ id: prerequisite, path: [...path, id], state, prerequisitesOf })
    if (cycle) return cycle
  }
  state.set(id, 'done')
  return null
}

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

export type SetupPlan = z.infer<typeof setupPlanSchema>
export type AcceptedSetupPlan = z.infer<typeof acceptedSetupPlanSchema>

type Step = { id: string; prerequisiteIds: string[] }
type StepCollection = 'repositoryActions' | 'targetActions' | 'verification'

export function validateIdentifiers(plan: SetupPlan, context: z.RefinementCtx): void {
  for (const [path, ids] of identifierCollections(plan)) {
    for (const id of duplicateIds(ids))
      context.addIssue({ code: 'custom', path: [path], message: `Duplicate id "${id}".` })
  }
}

export function validateTargetReferences(plan: SetupPlan, context: z.RefinementCtx): void {
  const knownTargetIds = new Set(plan.targets.map((target) => target.id))
  for (const [path, index, targetId] of targetReferences(plan)) {
    if (!knownTargetIds.has(targetId)) {
      context.addIssue({
        code: 'custom',
        path: [path, index, 'targetId'],
        message: `Unknown target id "${targetId}".`,
      })
    }
  }
}

export function validateDefaultTargets(plan: SetupPlan, context: z.RefinementCtx): void {
  const defaultCount = plan.targets.filter((target) => target.isDefault).length
  if (plan.targets.length > 0 && defaultCount !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['targets'],
      message: 'A nonempty target list must have exactly one default target.',
    })
  }
}

export function validatePrerequisites(plan: SetupPlan, context: z.RefinementCtx): void {
  const entries = prerequisiteEntries(plan)
  const stepIds = new Set(entries.map(([, , step]) => step.id))
  for (const [path, index, step] of entries) {
    validateStepPrerequisites({ path, index, step, stepIds, context })
  }
  const cycle = findsCycle(
    stepIds,
    new Map(entries.map(([, , step]) => [step.id, step.prerequisiteIds])),
  )
  if (cycle)
    context.addIssue({
      code: 'custom',
      path: ['targetActions'],
      message: `Prerequisite cycle: ${cycle}.`,
    })
}

function validateStepPrerequisites({
  path,
  index,
  step,
  stepIds,
  context,
}: {
  path: StepCollection
  index: number
  step: Step
  stepIds: Set<string>
  context: z.RefinementCtx
}): void {
  for (const prerequisiteId of step.prerequisiteIds) {
    if (!stepIds.has(prerequisiteId)) {
      context.addIssue({
        code: 'custom',
        path: [path, index, 'prerequisiteIds'],
        message: `Unknown prerequisite id "${prerequisiteId}".`,
      })
    }
  }
  if (step.prerequisiteIds.includes(step.id)) {
    context.addIssue({
      code: 'custom',
      path: [path, index, 'prerequisiteIds'],
      message: 'A step cannot list itself as its own prerequisite.',
    })
  }
}

function identifierCollections(plan: SetupPlan): Array<[string, string[]]> {
  return [
    ['targets', plan.targets.map((item) => item.id)],
    ['capabilities', plan.capabilities.map((item) => item.id)],
    ['toolRecommendations', plan.toolRecommendations.map((item) => item.id)],
    ['repositoryActions', plan.repositoryActions.map((item) => item.id)],
    ['targetActions', plan.targetActions.map((item) => item.id)],
    ['verification', plan.verification.map((item) => item.id)],
  ]
}

function targetReferences(plan: SetupPlan): Array<[string, number, string]> {
  return [
    ...plan.capabilities.flatMap((item, index) =>
      item.targetIds.map(
        (targetId) => ['capabilities', index, targetId] as [string, number, string],
      ),
    ),
    ...plan.targetActions.map(
      (item, index) => ['targetActions', index, item.targetId] as [string, number, string],
    ),
    ...plan.verification.map(
      (item, index) => ['verification', index, item.targetId] as [string, number, string],
    ),
  ]
}

function prerequisiteEntries(plan: SetupPlan): Array<[StepCollection, number, Step]> {
  return [
    ...plan.repositoryActions.map(
      (step, index) => ['repositoryActions', index, step] as [StepCollection, number, Step],
    ),
    ...plan.targetActions.map(
      (step, index) => ['targetActions', index, step] as [StepCollection, number, Step],
    ),
    ...plan.verification.map(
      (step, index) => ['verification', index, step] as [StepCollection, number, Step],
    ),
  ]
}

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const id of ids) {
    if (seen.has(id)) duplicates.push(id)
    seen.add(id)
  }
  return duplicates
}

export function validateSetupPlan(plan: SetupPlan, context: z.RefinementCtx): void {
  validateIdentifiers(plan, context)
  validateTargetReferences(plan, context)
  validateDefaultTargets(plan, context)
  validatePrerequisites(plan, context)
  validateVerificationCoverage(plan, context)
}

function validateVerificationCoverage(plan: SetupPlan, context: z.RefinementCtx): void {
  const verifiedTargetIds = new Set(plan.verification.map((step) => step.targetId))
  for (const target of plan.targets) {
    if (!verifiedTargetIds.has(target.id)) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: `Target "${target.id}" has no verification step.`,
      })
    }
  }
  const verifiedCapabilities = new Set(plan.verification.flatMap((step) => step.capabilityId ?? []))
  for (const capability of plan.capabilities) {
    if (capability.disposition === 'recommended' && !verifiedCapabilities.has(capability.id)) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: `Recommended capability "${capability.id}" has no verification step.`,
      })
    }
  }
}

export interface PlanValidationOutcome {
  valid: boolean
  issues: string[]
}

/** Proves stable IDs for unchanged items across a planning revision (#2381 revision rule). */
export function validatePlanRevision(
  previousPlan: SetupPlan,
  nextPlan: SetupPlan,
): PlanValidationOutcome {
  const issues =
    nextPlan.source.planRevision === previousPlan.source.planRevision
      ? ['A revised plan must advance its plan revision.']
      : []
  const previousKinds = entryKinds(previousPlan)
  const nextKinds = entryKinds(nextPlan)
  for (const [id, kind] of previousKinds) {
    const nextKind = nextKinds.get(id)
    if (nextKind && nextKind !== kind)
      issues.push(`Id "${id}" changed kind from "${kind}" to "${nextKind}" across revisions.`)
  }
  return { valid: issues.length === 0, issues }
}

function entryKinds(plan: SetupPlan): Map<string, string> {
  return new Map([
    ...plan.targets.map((item) => [item.id, 'target'] as const),
    ...plan.capabilities.map((item) => [item.id, 'capability'] as const),
    ...plan.toolRecommendations.map((item) => [item.id, 'toolRecommendation'] as const),
    ...[...plan.repositoryActions, ...plan.targetActions].map(
      (item) => [item.id, 'action'] as const,
    ),
    ...plan.verification.map((item) => [item.id, 'verification'] as const),
  ])
}

export const setupPlanningResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('needs-user-input'),
    revision: z.string().min(1),
    questions: z.array(projectSetupQuestionSchema).min(1),
  }),
  z.object({
    status: z.literal('ready-for-review'),
    revision: z.string().min(1),
    plan: setupPlanSchema,
  }),
  z.object({
    status: z.literal('cannot-plan'),
    revision: z.string().min(1),
    reason: z.enum([
      'inaccessible-project',
      'ambiguous-boundary',
      'unsupported-workspace',
      'skill-unavailable',
    ]),
    evidence: z.string().min(1),
    recoveryAction: z.string().min(1),
  }),
])

export type SetupPlanningResult = z.infer<typeof setupPlanningResultSchema>

export function parseSetupPlanningResult(value: unknown): SetupPlanningResult {
  return setupPlanningResultSchema.parse(value)
}

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
  const issues = validationIssues(sourcePlan, acceptedPlan)
  return { valid: issues.length === 0, issues }
}

function validationIssues(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan): string[] {
  const issues = revisionIssues(sourcePlan, acceptedPlan)
  for (const [name, acceptedItems, sourceItems] of boundedCollections(sourcePlan, acceptedPlan)) {
    const sourceById = new Map(sourceItems.map((item) => [item.id, item]))
    for (const acceptedItem of acceptedItems) {
      const sourceItem = sourceById.get(acceptedItem.id)
      if (!sourceItem) {
        issues.push(
          `Accepted ${name} entry "${acceptedItem.id}" is not present in the reviewed source plan.`,
        )
      } else if (!sameContent(sourceItem, acceptedItem)) {
        issues.push(
          `Accepted ${name} entry "${acceptedItem.id}" does not match the reviewed source plan.`,
        )
      }
    }
  }
  return issues
}

function revisionIssues(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan): string[] {
  const issues: string[] = []
  if (acceptedPlan.sourceRevision !== sourcePlan.source.planRevision) {
    issues.push(
      `Accepted plan revision "${acceptedPlan.sourceRevision}" does not match source revision "${sourcePlan.source.planRevision}".`,
    )
  }
  if (acceptedPlan.projectRoot !== sourcePlan.source.projectRoot) {
    issues.push('Accepted plan project root does not match the source plan.')
  }
  if (!sameContent(sourcePlan.source.fingerprints, acceptedPlan.fingerprints)) {
    issues.push('Fingerprint set does not retain the complete source fingerprint set.')
  }
  return issues
}

function boundedCollections(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan) {
  return [
    ['targets', acceptedPlan.targets, sourcePlan.targets],
    [
      'capabilities',
      acceptedPlan.capabilities,
      sourcePlan.capabilities.map(({ disposition: _disposition, ...capability }) => capability),
    ],
    ['toolRecommendations', acceptedPlan.toolRecommendations, sourcePlan.toolRecommendations],
    ['repositoryActions', acceptedPlan.repositoryActions, sourcePlan.repositoryActions],
    ['targetActions', acceptedPlan.targetActions, sourcePlan.targetActions],
    ['verification', acceptedPlan.verification, sourcePlan.verification],
  ] as const
}

function sameContent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
