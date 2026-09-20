// Cross-field rules for a setup plan (#2381 canonical onboarding agent contract). Kept apart from
// setup-plan.ts so the intrinsic superRefine body and the boundary validators that compare two
// already-parsed plans read as separate concerns.

import type { z } from 'zod'
import type { setupPlanSchema } from './setup-plan'

type SetupPlan = z.infer<typeof setupPlanSchema>

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

function findsCycle(ids: string[], prerequisitesOf: Map<string, string[]>): string | null {
  const state = new Map<string, 'visiting' | 'done'>()

  function visit(id: string, path: string[]): string | null {
    const status = state.get(id)
    if (status === 'done') return null
    if (status === 'visiting') return [...path, id].join(' -> ')
    state.set(id, 'visiting')
    for (const prerequisite of prerequisitesOf.get(id) ?? []) {
      const cycle = visit(prerequisite, [...path, id])
      if (cycle) return cycle
    }
    state.set(id, 'done')
    return null
  }

  for (const id of ids) {
    const cycle = visit(id, [])
    if (cycle) return cycle
  }
  return null
}

export function validateSetupPlan(plan: SetupPlan, context: z.RefinementCtx): void {
  const targetIds = plan.targets.map((target) => target.id)
  const capabilityIds = plan.capabilities.map((capability) => capability.id)
  const recommendationIds = plan.toolRecommendations.map((recommendation) => recommendation.id)
  const repositoryActionIds = plan.repositoryActions.map((action) => action.id)
  const targetActionIds = plan.targetActions.map((action) => action.id)
  const verificationIds = plan.verification.map((step) => step.id)

  const collections: Array<[string, string[]]> = [
    ['targets', targetIds],
    ['capabilities', capabilityIds],
    ['toolRecommendations', recommendationIds],
    ['repositoryActions', repositoryActionIds],
    ['targetActions', targetActionIds],
    ['verification', verificationIds],
  ]
  for (const [path, ids] of collections) {
    for (const duplicate of duplicateIds(ids)) {
      context.addIssue({ code: 'custom', path: [path], message: `Duplicate id "${duplicate}".` })
    }
  }

  const knownTargetIds = new Set(targetIds)
  const targetReferences: Array<[string, number, string]> = [
    ...plan.capabilities.flatMap((capability, index) =>
      capability.targetIds.map((targetId): [string, number, string] => [
        'capabilities',
        index,
        targetId,
      ]),
    ),
    ...plan.targetActions.map((action, index): [string, number, string] => [
      'targetActions',
      index,
      action.targetId,
    ]),
    ...plan.verification.map((step, index): [string, number, string] => [
      'verification',
      index,
      step.targetId,
    ]),
  ]
  for (const [path, index, targetId] of targetReferences) {
    if (!knownTargetIds.has(targetId)) {
      context.addIssue({
        code: 'custom',
        path: [path, index, 'targetId'],
        message: `Unknown target id "${targetId}".`,
      })
    }
  }

  const defaultTargets = plan.targets.filter((target) => target.isDefault)
  if (plan.targets.length === 0 && defaultTargets.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['targets'],
      message: 'A zero-target plan cannot name a default target.',
    })
  } else if (plan.targets.length > 0 && defaultTargets.length !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['targets'],
      message: 'A nonempty target list must have exactly one default target.',
    })
  }

  const allStepIds = new Set([...capabilityIds, ...repositoryActionIds, ...targetActionIds, ...verificationIds])
  const prerequisiteEntries: Array<[string, number, string[]]> = [
    ...plan.repositoryActions.map((action, index): [string, number, string[]] => [
      'repositoryActions',
      index,
      action.prerequisiteIds,
    ]),
    ...plan.targetActions.map((action, index): [string, number, string[]] => [
      'targetActions',
      index,
      action.prerequisiteIds,
    ]),
    ...plan.verification.map((step, index): [string, number, string[]] => [
      'verification',
      index,
      step.prerequisiteIds,
    ]),
  ]
  const prerequisitesOf = new Map<string, string[]>([
    ...plan.repositoryActions.map((action): [string, string[]] => [action.id, action.prerequisiteIds]),
    ...plan.targetActions.map((action): [string, string[]] => [action.id, action.prerequisiteIds]),
    ...plan.verification.map((step): [string, string[]] => [step.id, step.prerequisiteIds]),
  ])
  for (const [path, index, prerequisiteIds] of prerequisiteEntries) {
    for (const prerequisiteId of prerequisiteIds) {
      if (!allStepIds.has(prerequisiteId)) {
        context.addIssue({
          code: 'custom',
          path: [path, index, 'prerequisiteIds'],
          message: `Unknown prerequisite id "${prerequisiteId}".`,
        })
      }
    }
  }
  for (const [path, index, prerequisiteIds] of prerequisiteEntries) {
    const selfId =
      path === 'repositoryActions'
        ? plan.repositoryActions[index]?.id
        : path === 'targetActions'
          ? plan.targetActions[index]?.id
          : plan.verification[index]?.id
    if (selfId && prerequisiteIds.includes(selfId)) {
      context.addIssue({
        code: 'custom',
        path: [path, index, 'prerequisiteIds'],
        message: 'A step cannot list itself as its own prerequisite.',
      })
    }
  }
  const cycle = findsCycle([...allStepIds], prerequisitesOf)
  if (cycle) {
    context.addIssue({ code: 'custom', path: ['targetActions'], message: `Prerequisite cycle: ${cycle}.` })
  }

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
  const scopedCapabilityIds = new Set(
    plan.capabilities.filter((capability) => capability.disposition === 'recommended').map((c) => c.id),
  )
  const verifiedCapabilityIds = new Set(plan.verification.map((step) => step.capabilityId).filter(Boolean))
  for (const capabilityId of scopedCapabilityIds) {
    if (!verifiedCapabilityIds.has(capabilityId)) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: `Recommended capability "${capabilityId}" has no verification step.`,
      })
    }
  }

  void recommendationIds
}

export interface PlanValidationOutcome {
  valid: boolean
  issues: string[]
}

/** Proves stable IDs for unchanged items across a planning revision (#2381 revision rule). */
export function validatePlanRevision(previousPlan: SetupPlan, nextPlan: SetupPlan): PlanValidationOutcome {
  const issues: string[] = []
  if (nextPlan.source.planRevision === previousPlan.source.planRevision) {
    issues.push('A revised plan must advance its plan revision.')
  }

  const kindOf = (plan: SetupPlan) => {
    const map = new Map<string, string>()
    for (const target of plan.targets) map.set(target.id, 'target')
    for (const capability of plan.capabilities) map.set(capability.id, 'capability')
    for (const recommendation of plan.toolRecommendations) map.set(recommendation.id, 'toolRecommendation')
    for (const action of [...plan.repositoryActions, ...plan.targetActions]) map.set(action.id, 'action')
    for (const step of plan.verification) map.set(step.id, 'verification')
    return map
  }
  const previousKinds = kindOf(previousPlan)
  const nextKinds = kindOf(nextPlan)
  for (const [id, kind] of previousKinds) {
    const nextKind = nextKinds.get(id)
    if (nextKind && nextKind !== kind) {
      issues.push(`Id "${id}" changed kind from "${kind}" to "${nextKind}" across revisions.`)
    }
  }

  return { valid: issues.length === 0, issues }
}
