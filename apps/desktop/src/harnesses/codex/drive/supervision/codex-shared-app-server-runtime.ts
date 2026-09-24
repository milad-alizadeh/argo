import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type {
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { executableVersion } from '@/harnesses/cli/executable-version'
import { CodexModelCatalogCache } from '../protocol/model-catalog'
import type { WireMessage } from '../protocol/protocol'
import type { AppServerSupervisor, AppServerSupervisorDeps } from './app-server-supervisor-machine'
import { createAppServerSupervisor } from './app-server-supervisor-machine'

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
  readModelCatalog: () => Promise<CodexModelCatalog | null>
}

const runtimesByExecutable = new Map<string, SharedAppServerRuntime>()

function registerRuntime(key: string, runtime: SharedAppServerRuntime) {
  runtimesByExecutable.set(key, runtime)
  return runtime
}

function createModelCatalogReader(options: {
  findExecutable: AppServerSupervisorDeps['findExecutable']
  supervisor: AppServerSupervisor
  cache: CodexModelCatalogCache
  initialExecutable: string | null
  onExecutableChanged: (executablePath: string) => void
}) {
  let requestedIdentity: { executablePath: string | null; version: string | null } = {
    executablePath: options.initialExecutable,
    version: null,
  }
  let restartRequestedFor: string | null = null
  return async (): Promise<CodexModelCatalog | null> => {
    const executablePath = options.findExecutable()
    if (executablePath === null) {
      if (shouldStopForUnavailableExecutable(requestedIdentity, restartRequestedFor)) {
        requestedIdentity = { executablePath: null, version: null }
        restartRequestedFor = 'unavailable'
        options.supervisor.refreshExecutable(null)
      }
      return null
    }
    try {
      return await readCatalogForExecutablePath(executablePath, options, {
        requestedIdentity,
        restartRequestedFor,
        update: (identity, restartKey) => {
          requestedIdentity = identity
          restartRequestedFor = restartKey
        },
      })
    } catch {
      return null
    }
  }
}

async function readCatalogForExecutablePath(
  executablePath: string,
  options: Parameters<typeof createModelCatalogReader>[0],
  state: {
    requestedIdentity: { executablePath: string | null; version: string | null }
    restartRequestedFor: string | null
    update: (
      identity: { executablePath: string; version: string },
      restartKey: string | null,
    ) => void
  },
) {
  const identity = { executablePath, version: await executableVersion(executablePath) }
  const runningIdentity = options.supervisor.getRunningIdentity()
  if (!catalogIdentityMatches(identity, state.requestedIdentity, runningIdentity)) {
    const key = `${executablePath}\u0000${identity.version}`
    if (state.restartRequestedFor !== key) {
      state.update(identity, key)
      options.onExecutableChanged(executablePath)
      options.supervisor.refreshExecutable(executablePath)
    }
  } else {
    state.update(identity, null)
    options.onExecutableChanged(executablePath)
  }
  const channel = await waitForMatchingChannel(options.supervisor, identity)
  if (channel === null) return null
  state.update(identity, null)
  return options.cache.get(identity, (params, decode) =>
    channel.request('model/list', params, decode),
  )
}

async function waitForMatchingChannel(
  supervisor: AppServerSupervisor,
  identity: { executablePath: string; version: string },
) {
  const deadline = Date.now() + 3_000
  while (Date.now() < deadline) {
    const running = supervisor.getRunningIdentity()
    const channel = supervisor.getChannel()
    if (
      channel !== null &&
      running?.executablePath === identity.executablePath &&
      running.version === identity.version
    ) {
      return channel
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return null
}

function shouldStopForUnavailableExecutable(
  identity: { executablePath: string | null; version: string | null },
  restartRequestedFor: string | null,
) {
  return identity.executablePath !== null && restartRequestedFor !== 'unavailable'
}

function createSupervisor(executable: string | null, registries: Set<ManagedSessionRegistry>) {
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
  return supervisor
}

function catalogIdentityMatches(
  current: { executablePath: string; version: string },
  requested: { executablePath: string | null; version: string | null },
  running: { executablePath: string; version: string } | null,
) {
  return (
    requested.executablePath === current.executablePath &&
    (requested.version === null || requested.version === current.version) &&
    (running === null ||
      (running.executablePath === current.executablePath && running.version === current.version))
  )
}

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
  const modelCatalogCache = new CodexModelCatalogCache()
  const keyOf = (session: SessionProjection['session']) => `${session.harness}:${session.nativeId}`
  let mappedExecutableKey = executableKey
  const supervisor = createSupervisor(executable, registries)
  let runtime: SharedAppServerRuntime
  const readModelCatalog = createModelCatalogReader({
    findExecutable,
    supervisor,
    cache: modelCatalogCache,
    initialExecutable: executable,
    onExecutableChanged: (executablePath) => {
      if (mappedExecutableKey === executablePath) return
      runtimesByExecutable.delete(mappedExecutableKey)
      mappedExecutableKey = executablePath
      runtimesByExecutable.set(mappedExecutableKey, runtime)
    },
  })
  runtime = {
    supervisor,
    attach: (registry) => {
      registries.add(registry)
      return () => {
        registries.delete(registry)
        if (registries.size !== 0) return
        supervisor.close()
        runtimesByExecutable.delete(mappedExecutableKey)
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
    readModelCatalog,
  }
  return registerRuntime(executableKey, runtime)
}
