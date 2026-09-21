import type { ProjectSetupCommandRequest } from '@/domains/projects/contract/contract'
import type { ProjectSetupEffects } from '@/domains/projects/main/setup/project-setup-effects'
import type { createProjectSetupRegistry } from '@/domains/projects/main/setup/project-setup-registry'
import { startApplicationEffect } from './project-setup-application-effect'
import {
  cancelActiveProjectSetupEffect,
  decidePendingProjectSetupEffect,
  finalizeProjectSetupEffect,
} from './project-setup-completion-effect'
import { continueProjectSetupPlanning } from './project-setup-planning-continuation'
import { startProjectSetupPreflight } from './project-setup-preflight'
export function startProjectSetupEffect({
  effects,
  projectId,
  registry,
  request,
  snapshot,
}: {
  effects: ProjectSetupEffects | undefined
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  request: ProjectSetupCommandRequest
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}): void {
  if (!effects) return
  switch (request.command.type) {
    case 'choose-agent':
      void startProjectSetupPreflight({
        effects,
        harness: request.command.harness,
        projectId,
        registry,
      })
      return
    case 'retry-preflight':
      if (snapshot.attempt)
        void startProjectSetupPreflight({
          effects,
          harness: snapshot.attempt.planningHarness,
          projectId,
          registry,
        })
      return
    case 'answer-questions':
      continueProjectSetupPlanning({ effects, projectId, registry, snapshot, request })
      return
    case 'request-plan-change':
      continueProjectSetupPlanning({ effects, projectId, registry, snapshot, request })
      return
    case 'accept-plan':
      startAcceptedApplication({ effects, projectId, registry, request, snapshot })
      return
    case 'resume-planning':
      continueProjectSetupPlanning({ effects, projectId, registry, snapshot, request })
      return
    case 'resume-application':
      void resumeApplication({ effects, projectId, registry, snapshot })
      return
    case 'cancel-setup':
      void cancelActiveProjectSetupEffect({ effects, projectId, registry, snapshot })
      return
    case 'retry-cancel':
      void cancelActiveProjectSetupEffect({ effects, projectId, registry, snapshot })
      return
    case 'approve-final-diff':
      void finalizeProjectSetupEffect({ effects, projectId, registry })
      return
    case 'approve-effect':
      decidePendingProjectSetupEffect({ allow: true, effects, snapshot })
      return
    case 'reject-effect':
      decidePendingProjectSetupEffect({ allow: false, effects, snapshot })
      return
    default:
      return
  }
}

function startAcceptedApplication({
  effects,
  projectId,
  registry,
  request,
  snapshot,
}: {
  effects: ProjectSetupEffects
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  request: ProjectSetupCommandRequest
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}) {
  if (request.command.type !== 'accept-plan' || !snapshot.attempt?.applicationHarness) return
  void startApplicationEffect({
    acceptedPlan: request.command.acceptedPlan,
    effects,
    harness: snapshot.attempt.applicationHarness,
    projectId,
    registry,
  })
}

async function resumeApplication({
  effects,
  projectId,
  registry,
  snapshot,
}: {
  effects: ProjectSetupEffects
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}): Promise<void> {
  if (!snapshot.acceptedPlan || !snapshot.attempt?.applicationHarness) return
  if (!snapshot.attempt.applicationSessionId) return
  try {
    const reconciliation = await effects.reconcile?.({
      acceptedPlan: snapshot.acceptedPlan,
      projectId,
      sessionId: snapshot.attempt.applicationSessionId,
    })
    if (reconciliation?.kind === 'drifted') {
      registry.transition(projectId, { type: 'EFFECT_INTERRUPTED', reason: reconciliation.reason })
      return
    }
  } catch {
    registry.transition(projectId, {
      type: 'EFFECT_INTERRUPTED',
      reason: 'Argo could not reconcile the recorded application Session and setup worktree.',
    })
    return
  }
  await startApplicationEffect({
    acceptedPlan: snapshot.acceptedPlan,
    effects,
    harness: snapshot.attempt.applicationHarness,
    projectId,
    registry,
    sessionId: snapshot.attempt.applicationSessionId,
  })
}
