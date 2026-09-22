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
}

let sharedAppServerRuntime: SharedAppServerRuntime | null = null

export function sharedAppServerRuntimeFor(
  findExecutable: AppServerSupervisorDeps['findExecutable'],
): SharedAppServerRuntime {
  if (sharedAppServerRuntime !== null) return sharedAppServerRuntime
  const registries = new Set<ManagedSessionRegistry>()
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
  }
  return sharedAppServerRuntime
}
