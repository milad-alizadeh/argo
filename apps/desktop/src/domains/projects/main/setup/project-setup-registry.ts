import type { Snapshot } from 'xstate'
import {
  createProjectSetupActor,
  PROJECT_SETUP_MACHINE_VERSION,
  type ProjectSetupActor,
  type ProjectSetupEvent,
  setupScreenOf,
} from './project-setup-machine'
import { isManualProjectDetails } from './project-setup-manual-details'

export type ProjectSetupRecord = {
  checkpointVersion: 1
  machineVersion: number
  projectId: string
  revision: number
  savedAt: string
  persistedSnapshot: Snapshot<unknown>
  receipts: Record<string, ProjectSetupSnapshot>
}

export type ProjectSetupSnapshot = {
  projectId: string
  revision: number
  screen: 'choosing-method' | 'manual' | 'deferred' | 'ready'
  manualSource: string
}

type SnapshotListener = (snapshot: ProjectSetupSnapshot) => void

export type ProjectSetupStore = {
  readProjectSetup: (projectId: string) => ProjectSetupRecord | null
  writeProjectSetup: (record: ProjectSetupRecord) => void
}

type RegisteredActor = {
  actor: ProjectSetupActor
  receipts: Record<string, ProjectSetupSnapshot>
  revision: number
}

type RegistryState = {
  actors: Map<string, RegisteredActor>
  allListeners: Set<(projectId: string, snapshot: ProjectSetupSnapshot) => void>
  listeners: Map<string, Set<SnapshotListener>>
}

// One registry is shared by all windows in the main process. Its serialized command path makes a
// revision check authoritative instead of asking each renderer to coordinate with the others.
export function createProjectSetupRegistry(store: ProjectSetupStore) {
  const state: RegistryState = { actors: new Map(), allListeners: new Set(), listeners: new Map() }

  return {
    snapshot: (projectId: string) => snapshot({ state, store, projectId }),
    command({
      commandId,
      event,
      expectedRevision,
      projectId,
    }: {
      commandId: string
      event: ProjectSetupEvent
      expectedRevision: number
      projectId: string
    }): ProjectSetupSnapshot {
      const entry = registered(state, store, projectId)
      const receipt = entry.receipts[commandId]
      if (receipt) return receipt
      const current = snapshot({ state, store, projectId, entry })
      if (expectedRevision !== current.revision) return current
      if (event.type === 'SAVE_MANUAL' && !isManualProjectDetails(event.source)) {
        return current
      }
      entry.actor.send(event)
      entry.revision += 1
      const next = snapshot({ state, store, projectId, entry })
      entry.receipts[commandId] = next
      store.writeProjectSetup({
        checkpointVersion: 1,
        machineVersion: PROJECT_SETUP_MACHINE_VERSION,
        projectId,
        revision: entry.revision,
        savedAt: new Date().toISOString(),
        persistedSnapshot: entry.actor.getPersistedSnapshot(),
        receipts: entry.receipts,
      })
      publish({ state, store, projectId, entry })
      return next
    },
    subscribe(projectId: string, listener: SnapshotListener): () => void {
      const projectListeners = state.listeners.get(projectId) ?? new Set<SnapshotListener>()
      projectListeners.add(listener)
      state.listeners.set(projectId, projectListeners)
      listener(snapshot({ state, store, projectId }))
      return () => {
        projectListeners.delete(listener)
        if (projectListeners.size === 0) state.listeners.delete(projectId)
      }
    },
    subscribeAll(
      listener: (projectId: string, snapshot: ProjectSetupSnapshot) => void,
    ): () => void {
      state.allListeners.add(listener)
      return () => state.allListeners.delete(listener)
    },
  }
}

function registered(
  state: RegistryState,
  store: ProjectSetupStore,
  projectId: string,
): RegisteredActor {
  const current = state.actors.get(projectId)
  if (current) return current
  const saved = store.readProjectSetup(projectId)
  const actor = createProjectSetupActor(saved?.persistedSnapshot)
  actor.start()
  const next = { actor, receipts: saved?.receipts ?? {}, revision: saved?.revision ?? 0 }
  state.actors.set(projectId, next)
  return next
}

function snapshot({
  state,
  store,
  projectId,
  entry = registered(state, store, projectId),
}: {
  state: RegistryState
  store: ProjectSetupStore
  projectId: string
  entry?: RegisteredActor
}): ProjectSetupSnapshot {
  return {
    projectId,
    revision: entry.revision,
    screen: setupScreenOf(entry.actor) as ProjectSetupSnapshot['screen'],
    manualSource: entry.actor.getSnapshot().context.manualSource,
  }
}

function publish({
  state,
  store,
  projectId,
  entry,
}: {
  state: RegistryState
  store: ProjectSetupStore
  projectId: string
  entry: RegisteredActor
}): void {
  const current = snapshot({ state, store, projectId, entry })
  for (const listener of state.listeners.get(projectId) ?? []) listener(current)
  for (const listener of state.allListeners) listener(projectId, current)
}
