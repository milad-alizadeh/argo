import type {
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type {
  AppServerSupervisor,
  AppServerSupervisorDeps,
} from '@/harnesses/codex/drive/app-server-supervisor-machine'
import { createAppServerSupervisor } from '@/harnesses/codex/drive/app-server-supervisor-machine'
import type { WireMessage } from '@/harnesses/codex/drive/protocol'

type ManagedSessionRegistry = {
  dispatchNotification: (message: WireMessage) => void
  notifyChannelLost: () => void
  notifyChannelRestored: () => void
}

type SharedAppServerRuntime = {
  supervisor: AppServerSupervisor
  attach: (registry: ManagedSessionRegistry) => () => void
  observe: (
    session: SessionProjection['session'],
    listener: (projection: SessionProjection) => void,
  ) => Unsubscribe | undefined
  publish: (projection: SessionProjection) => void
  projections: () => readonly SessionProjection[]
}

let sharedAppServerRuntime: SharedAppServerRuntime | null = null

export function sharedAppServerRuntimeFor(
  findExecutable: AppServerSupervisorDeps['findExecutable'],
): SharedAppServerRuntime {
  if (sharedAppServerRuntime !== null) return sharedAppServerRuntime
  const registries = new Set<ManagedSessionRegistry>()
  const projections = new Map<string, SessionProjection>()
  const observers = new Map<string, Set<(projection: SessionProjection) => void>>()
  const keyOf = (session: SessionProjection['session']) => `${session.harness}:${session.nativeId}`
  const supervisor = createAppServerSupervisor({
    findExecutable,
    dispatchNotification: (message) => {
      for (const registry of registries) registry.dispatchNotification(message)
    },
    onChannelLost: () => {
      for (const registry of registries) registry.notifyChannelLost()
    },
    onChannelRestored: () => {
      for (const registry of registries) registry.notifyChannelRestored()
    },
  })
  supervisor.actor.start()
  sharedAppServerRuntime = {
    supervisor,
    attach: (registry) => {
      registries.add(registry)
      return () => {
        registries.delete(registry)
        if (registries.size !== 0) return
        supervisor.close()
        sharedAppServerRuntime = null
      }
    },
    observe: (session, listener) => {
      const key = keyOf(session)
      const projection = projections.get(key)
      if (projection === undefined) return undefined
      const listeners = observers.get(key) ?? new Set()
      observers.set(key, listeners)
      listeners.add(listener)
      listener({ ...projection, posture: 'watched' })
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) observers.delete(key)
      }
    },
    publish: (projection) => {
      const key = keyOf(projection.session)
      projections.set(key, projection)
      for (const listener of observers.get(key) ?? []) {
        listener({ ...projection, posture: 'watched' })
      }
    },
    projections: () => [...projections.values()],
  }
  return sharedAppServerRuntime
}
