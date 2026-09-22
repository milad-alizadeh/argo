import type {
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { AppServerSupervisor, AppServerSupervisorDeps } from './app-server-supervisor-machine'
import { createAppServerSupervisor } from './app-server-supervisor-machine'
import type { WireMessage } from './protocol'

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

const runtimesByExecutable = new Map<string, SharedAppServerRuntime>()

export function sharedAppServerRuntimeFor(
  findExecutable: AppServerSupervisorDeps['findExecutable'],
): SharedAppServerRuntime {
  const executable = findExecutable()
  const executableKey = executable ?? ''
  const existing = runtimesByExecutable.get(executableKey)
  if (existing !== undefined) return existing
  const registries = new Set<ManagedSessionRegistry>()
  const projections = new Map<string, SessionProjection>()
  const observers = new Map<string, Set<(projection: SessionProjection) => void>>()
  const keyOf = (session: SessionProjection['session']) => `${session.harness}:${session.nativeId}`
  const supervisor = createAppServerSupervisor({
    findExecutable: () => executable,
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
  const runtime: SharedAppServerRuntime = {
    supervisor,
    attach: (registry) => {
      registries.add(registry)
      return () => {
        registries.delete(registry)
        if (registries.size !== 0) return
        supervisor.close()
        runtimesByExecutable.delete(executableKey)
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
  runtimesByExecutable.set(executableKey, runtime)
  return runtime
}
