import type { Snapshot } from 'xstate'
import { validateAcceptedSetupPlan } from '@/domains/projects/contract/setup'
import {
  inactiveProjectSetupRuntime,
  type ProjectSetupRuntime,
} from '@/domains/projects/main/setup/actors/project-setup-actors'
import { isManualProjectDetails } from '@/domains/projects/main/setup/preparation/project-setup-manual-details'
import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'
import {
  type ProjectSetupSnapshot,
  projectSetupSnapshot,
} from '@/domains/projects/main/setup/project-setup-snapshot'
import { registeredProjectSetupActor } from './project-setup-registry-hydration'

export type ProjectSetupRecord = {
  checkpointVersion: 1
  machineVersion: number
  projectId: string
  revision: number
  savedAt: string
  persistedSnapshot: Snapshot<unknown>
  receipts: Record<string, ProjectSetupSnapshot>
}

export type { ProjectSetupSnapshot } from '@/domains/projects/main/setup/project-setup-snapshot'

export type ProjectSetupStore = {
  readProjectSetup: (projectId: string) => ProjectSetupRecord | null
  writeProjectSetup: (record: ProjectSetupRecord) => void
}

export type RegisteredProjectSetupActor = {
  actor: import('../project-setup-actor').ProjectSetupActor
  observedSnapshot: ReturnType<import('../project-setup-actor').ProjectSetupActor['getSnapshot']>
  pendingCommandId: string | null
  receipts: Record<string, ProjectSetupSnapshot>
  revision: number
}

export type ProjectSetupRegistryState = {
  actors: Map<string, RegisteredProjectSetupActor>
  allListeners: Set<(projectId: string, snapshot: ProjectSetupSnapshot) => void>
  runtime: ProjectSetupRuntime
  listeners: Map<string, Set<(snapshot: ProjectSetupSnapshot) => void>>
}

type RegistryCommand = {
  commandId: string
  event: ProjectSetupEvent
  expectedRevision: number
  projectId: string
}

export function createProjectSetupRegistry(
  store: ProjectSetupStore,
  runtime: ProjectSetupRuntime = inactiveProjectSetupRuntime,
) {
  const state: ProjectSetupRegistryState = {
    actors: new Map(),
    allListeners: new Set(),
    runtime,
    listeners: new Map(),
  }

  return {
    snapshot: (projectId: string) => snapshot({ state, store, projectId }),
    command: (request: RegistryCommand) => command({ ...request, state, store }).snapshot,
    commandWithStatus: (request: RegistryCommand) => command({ ...request, state, store }),
    transition(projectId: string, event: ProjectSetupEvent): ProjectSetupSnapshot {
      const entry = registeredProjectSetupActor(state, store, projectId)
      entry.actor.send(event)
      return snapshot({ state, store, projectId, entry })
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
  if (event.type === 'Save manual' && !isManualProjectDetails(event.source)) {
    return { accepted: false, snapshot: current }
  }
  if (event.type === 'Accept plan') {
    const reviewedPlan = entry.actor.getSnapshot().context.plan
    if (reviewedPlan === null || !validateAcceptedSetupPlan(reviewedPlan, event.acceptedPlan).valid)
      return { accepted: false, snapshot: current }
  }
  const before = entry.actor.getSnapshot()
  entry.pendingCommandId = commandId
  entry.actor.send(event)
  entry.pendingCommandId = null
  if (entry.actor.getSnapshot() === before) return { accepted: false, snapshot: current }
  return { accepted: true, snapshot: entry.receipts[commandId] ?? current }
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
