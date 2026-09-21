import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { createProjectSetupActor } from './project-setup-actor'
import { saveProjectSetupRecord } from './project-setup-record'
import type {
  ProjectSetupRegistryState,
  ProjectSetupStore,
  RegisteredProjectSetupActor,
} from './project-setup-registry'

export function registeredProjectSetupActor(
  state: ProjectSetupRegistryState,
  store: ProjectSetupStore,
  projectId: string,
): RegisteredProjectSetupActor {
  const current = state.actors.get(projectId)
  if (current) return current
  const saved = store.readProjectSetup(projectId)
  const actor = createProjectSetupActor(saved?.persistedSnapshot)
  actor.start()
  const recoveredEffect = actor.getSnapshot().context.activeEffect
  const recoveredFinalization = finalizationRecovery(store, projectId, actor)
  if (recoveredEffect !== null)
    actor.send({
      type: 'EFFECT_INTERRUPTED',
      reason: `The ${recoveredEffect} effect was interrupted by an application restart.`,
    })
  const recovered = recoveredEffect !== null || recoveredFinalization
  const entry = {
    actor,
    receipts: saved?.receipts ?? {},
    revision: (saved?.revision ?? 0) + (recovered ? 1 : 0),
  }
  state.actors.set(projectId, entry)
  if (recovered) saveProjectSetupRecord({ ...entry, projectId, store })
  return entry
}

function finalizationRecovery(
  store: ProjectSetupStore,
  projectId: string,
  actor: RegisteredProjectSetupActor['actor'],
): boolean {
  if (!actor.getSnapshot().matches('finalizing') || !isProjectStore(store)) return false
  const checkpoint = store.readSetupCheckpoint(projectId)
  const project = store.read().projects.find((candidate) => candidate.id === projectId)
  if (checkpoint?.phase === 'ready' && project?.path === checkpoint.worktreePath) {
    actor.send({ type: 'FINALIZATION_COMPLETED' })
    return true
  }
  actor.send({
    type: 'FINALIZATION_FAILED',
    reason: 'Argo could not confirm that the approved setup worktree was promoted before restart.',
  })
  return true
}

function isProjectStore(
  store: ProjectSetupStore,
): store is ProjectSetupStore & Pick<ProjectStore, 'read' | 'readSetupCheckpoint'> {
  return 'read' in store && 'readSetupCheckpoint' in store
}
