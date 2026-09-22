import type { ProjectStore } from '../../sqlite-store'
import { createProjectSetupActor } from '../project-setup-actor'
import { projectSetupSnapshot } from '../project-setup-snapshot'
import type {
  ProjectSetupRegistryState,
  ProjectSetupStore,
  RegisteredProjectSetupActor,
} from './project-setup-registry'
import { saveProjectSetupRecord } from './project-setup-storage'

export function registeredProjectSetupActor(
  state: ProjectSetupRegistryState,
  store: ProjectSetupStore,
  projectId: string,
): RegisteredProjectSetupActor {
  const current = state.actors.get(projectId)
  if (current) return current
  const saved = store.readProjectSetup(projectId)
  const actor = createProjectSetupActor(saved?.persistedSnapshot, state.runtime.actors(projectId))
  const entry: RegisteredProjectSetupActor = {
    actor,
    observedSnapshot: actor.getSnapshot(),
    pendingCommandId: null,
    receipts: saved?.receipts ?? {},
    revision: saved?.revision ?? 0,
  }
  state.actors.set(projectId, entry)
  actor.subscribe((nextActorSnapshot) => {
    if (nextActorSnapshot === entry.observedSnapshot) return
    entry.observedSnapshot = nextActorSnapshot
    entry.revision += 1
    const next = projectSetupSnapshot({ actor, projectId, revision: entry.revision })
    if (entry.pendingCommandId) entry.receipts[entry.pendingCommandId] = next
    saveProjectSetupRecord({ ...entry, projectId, store })
    for (const listener of state.listeners.get(projectId) ?? []) listener(next)
    for (const listener of state.allListeners) listener(projectId, next)
  })
  actor.start()
  const recoveredEffect = actor.getSnapshot().context.activeEffect
  const recoveredFinalization = finalizationRecovery(store, projectId, actor)
  if (recoveredEffect !== null)
    actor.send({
      type: 'Effect interrupted',
      reason: 'restart-interrupted',
    })
  if (recoveredFinalization) entry.observedSnapshot = actor.getSnapshot()
  return entry
}

function finalizationRecovery(
  store: ProjectSetupStore,
  projectId: string,
  actor: RegisteredProjectSetupActor['actor'],
): boolean {
  if (!actor.getSnapshot().matches('Finalizing') || !isProjectStore(store)) return false
  const checkpoint = store.readSetupCheckpoint(projectId)
  const project = store.read().projects.find((candidate) => candidate.id === projectId)
  if (checkpoint?.phase === 'ready' && project?.path === checkpoint.worktreePath) {
    actor.send({ type: 'Finalization completed' })
    return true
  }
  actor.send({
    type: 'Finalization failed',
    reason: 'restart-finalization-unconfirmed',
  })
  return true
}

function isProjectStore(
  store: ProjectSetupStore,
): store is ProjectSetupStore & Pick<ProjectStore, 'read' | 'readSetupCheckpoint'> {
  return 'read' in store && 'readSetupCheckpoint' in store
}
