import type { Snapshot } from 'xstate'
import { validateAcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import type { ProjectSetupEvent } from './project-setup-machine-types'
import { isManualProjectDetails } from './project-setup-manual-details'
import { saveProjectSetupRecord } from './project-setup-record'
import { registeredProjectSetupActor } from './project-setup-registry-hydration'
import { type ProjectSetupSnapshot, projectSetupSnapshot } from './project-setup-snapshot'

export type ProjectSetupRecord = {
  checkpointVersion: 1
  machineVersion: number
  projectId: string
  revision: number
  savedAt: string
  persistedSnapshot: Snapshot<unknown>
  receipts: Record<string, ProjectSetupSnapshot>
}

export type { ProjectSetupSnapshot } from './project-setup-snapshot'

export type ProjectSetupStore = {
  readProjectSetup: (projectId: string) => ProjectSetupRecord | null
  writeProjectSetup: (record: ProjectSetupRecord) => void
}

export type RegisteredProjectSetupActor = {
  actor: import('./project-setup-actor').ProjectSetupActor
  receipts: Record<string, ProjectSetupSnapshot>
  revision: number
}

export type ProjectSetupRegistryState = {
  actors: Map<string, RegisteredProjectSetupActor>
  allListeners: Set<(projectId: string, snapshot: ProjectSetupSnapshot) => void>
  listeners: Map<string, Set<(snapshot: ProjectSetupSnapshot) => void>>
}

type RegistryCommand = {
  commandId: string
  event: ProjectSetupEvent
  expectedRevision: number
  projectId: string
}

export function createProjectSetupRegistry(store: ProjectSetupStore) {
  const state: ProjectSetupRegistryState = {
    actors: new Map(),
    allListeners: new Set(),
    listeners: new Map(),
  }

  return {
    snapshot: (projectId: string) => snapshot({ state, store, projectId }),
    command: (request: RegistryCommand) => command({ ...request, state, store }).snapshot,
    commandWithStatus: (request: RegistryCommand) => command({ ...request, state, store }),
    transition(projectId: string, event: ProjectSetupEvent): ProjectSetupSnapshot {
      const entry = registeredProjectSetupActor(state, store, projectId)
      entry.actor.send(event)
      entry.revision += 1
      const next = snapshot({ state, store, projectId, entry })
      saveProjectSetupRecord({ ...entry, projectId, store })
      publish({ state, store, projectId, entry })
      return next
    },
    subscribe(projectId: string, listener: (snapshot: ProjectSetupSnapshot) => void): () => void {
      const projectListeners =
        state.listeners.get(projectId) ?? new Set<(snapshot: ProjectSetupSnapshot) => void>()
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

function command({
  commandId,
  event,
  expectedRevision,
  projectId,
  state,
  store,
}: RegistryCommand & { state: ProjectSetupRegistryState; store: ProjectSetupStore }): {
  accepted: boolean
  snapshot: ProjectSetupSnapshot
} {
  const entry = registeredProjectSetupActor(state, store, projectId)
  const receipt = entry.receipts[commandId]
  if (receipt) return { accepted: false, snapshot: receipt }
  const current = snapshot({ state, store, projectId, entry })
  if (expectedRevision !== current.revision) return { accepted: false, snapshot: current }
  if (event.type === 'SAVE_MANUAL' && !isManualProjectDetails(event.source)) {
    return { accepted: false, snapshot: current }
  }
  if (event.type === 'ACCEPT_PLAN') {
    const reviewedPlan = entry.actor.getSnapshot().context.plan
    if (reviewedPlan === null || !validateAcceptedSetupPlan(reviewedPlan, event.acceptedPlan).valid)
      return { accepted: false, snapshot: current }
  }
  const before = entry.actor.getSnapshot()
  entry.actor.send(event)
  if (entry.actor.getSnapshot() === before) return { accepted: false, snapshot: current }
  entry.revision += 1
  const next = snapshot({ state, store, projectId, entry })
  entry.receipts[commandId] = next
  saveProjectSetupRecord({ ...entry, projectId, store })
  publish({ state, store, projectId, entry })
  return { accepted: true, snapshot: next }
}

function snapshot({
  state,
  store,
  projectId,
  entry = registeredProjectSetupActor(state, store, projectId),
}: {
  state: ProjectSetupRegistryState
  store: ProjectSetupStore
  projectId: string
  entry?: RegisteredProjectSetupActor
}): ProjectSetupSnapshot {
  return projectSetupSnapshot({ actor: entry.actor, projectId, revision: entry.revision })
}

function publish({
  state,
  store,
  projectId,
  entry,
}: {
  state: ProjectSetupRegistryState
  store: ProjectSetupStore
  projectId: string
  entry: RegisteredProjectSetupActor
}): void {
  const current = snapshot({ state, store, projectId, entry })
  for (const listener of state.listeners.get(projectId) ?? []) listener(current)
  for (const listener of state.allListeners) listener(projectId, current)
}
