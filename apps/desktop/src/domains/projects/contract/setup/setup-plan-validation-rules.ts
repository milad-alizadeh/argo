import type { z } from 'zod'
import { findsCycle } from './setup-plan-cycle'
import type { setupPlanSchema } from './setup-plan-schema'

type SetupPlan = z.infer<typeof setupPlanSchema>
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
