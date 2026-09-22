import { createActor } from 'xstate'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionAdapter,
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type {
  AppServerSupervisor,
  AppServerSupervisorDeps,
} from '@/harnesses/codex/drive/app-server-supervisor-machine'
import {
  executeCommand,
  executeSend,
  requireSessionEntry,
  type SessionRegistry,
} from '@/harnesses/codex/drive/codex-session-commands'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error'
import type { ManagedSessionActor } from '@/harnesses/codex/drive/codex-session-projection'
import { projectionFrom } from '@/harnesses/codex/drive/codex-session-projection'
import { sharedAppServerRuntimeFor } from '@/harnesses/codex/drive/codex-shared-app-server-runtime'
import type { ManagedSessionDeps } from '@/harnesses/codex/drive/managed-session-machine'
import { createManagedSessionMachine } from '@/harnesses/codex/drive/managed-session-machine'

function keyOf(session: SessionIdentity): string {
  return `${session.harness}:${session.nativeId}`
}

function waitForIdentity(actor: ManagedSessionActor): Promise<void> {
  const initial = actor.getSnapshot()
  if (initial.context.sessionId !== null) return Promise.resolve()
  if (initial.matches('Failed')) return Promise.reject(new CodexSessionDriverError('launch-failed'))
  return new Promise((resolve, reject) => {
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.context.sessionId !== null) {
        subscription.unsubscribe()
        resolve()
      } else if (snapshot.matches('Failed')) {
        subscription.unsubscribe()
        reject(new CodexSessionDriverError('launch-failed'))
      }
    })
  })
}

function waitForChannel(supervisor: AppServerSupervisor): Promise<void> {
  if (supervisor.getChannel() !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const subscription = supervisor.actor.subscribe((snapshot) => {
      if (supervisor.getChannel() !== null) {
        subscription.unsubscribe()
        resolve()
      } else if (snapshot.matches('Backoff')) {
        subscription.unsubscribe()
        reject(new CodexSessionDriverError('launch-failed'))
      }
    })
    if (supervisor.getChannel() !== null) {
      subscription.unsubscribe()
      resolve()
    }
  })
}

function attachRegistry(
  appServer: ReturnType<typeof sharedAppServerRuntimeFor>,
  registry: SessionRegistry,
) {
  return appServer.attach({
    dispatchNotification: (message) => {
      for (const entry of registry.values()) entry.actor.send({ type: 'Notification', message })
    },
    notifyChannelLost: () => {
      for (const entry of registry.values()) entry.actor.send({ type: 'Channel lost' })
    },
    notifyChannelRestored: () => {
      for (const entry of registry.values()) entry.actor.send({ type: 'Channel restored' })
    },
  })
}

// One Codex `SessionAdapter` per window (ADR-0047): each one contributes child actors keyed by
// native Session ID to the main-process app-server supervisor. `execute` sends the command and
// reports the resulting snapshot; ongoing updates stream to subscribers, not through its return.
export function createCodexSessionAdapter(deps: {
  findExecutable: AppServerSupervisorDeps['findExecutable']
  sessionService: ManagedSessionDeps['sessionService']
  waitForWorkspaceReady: ManagedSessionDeps['waitForWorkspaceReady']
  now: ManagedSessionDeps['now']
  // Resolving a WorkspaceSelection to a concrete Workspace (creating a Git worktree when the
  // selection asks for one) is Workspace-domain work, not this Harness actor's (ADR-0024).
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
}): CodexSessionAdapter {
  const registry: SessionRegistry = new Map()
  const rosterListeners = new Set<() => void>()

  const appServer = sharedAppServerRuntimeFor(deps.findExecutable)
  const supervisor = appServer.supervisor
  const detach = attachRegistry(appServer, registry)

  const machine = createManagedSessionMachine({
    getChannel: supervisor.getChannel,
    sessionService: deps.sessionService,
    waitForWorkspaceReady: deps.waitForWorkspaceReady,
    now: deps.now,
  })

  function registerOnceIdentified(actor: ManagedSessionActor) {
    const notify: Parameters<ManagedSessionActor['subscribe']>[0] = (snapshot) => {
      if (snapshot.context.sessionId === null) return
      const key = keyOf(snapshot.context.sessionId)
      let entry = registry.get(key)
      if (entry === undefined) {
        entry = { actor, revision: 0, listeners: new Set() }
        registry.set(key, entry)
      }
      entry.revision += 1
      const projection = projectionFrom(snapshot, entry.revision)
      appServer.publish(projection)
      for (const listener of rosterListeners) listener()
      for (const listener of entry.listeners) listener(projection)
    }
    actor.subscribe(notify)
    notify(actor.getSnapshot())
  }

  async function start(selection: WorkspaceSelection, prompt: string) {
    const { workspaceId, cwd } = await deps.resolveWorkspace(selection)
    await waitForChannel(supervisor)
    const actor = createActor(machine, { input: { kind: 'start', workspaceId, cwd } }).start()
    registerOnceIdentified(actor)
    await waitForIdentity(actor)
    const identity = actor.getSnapshot().context.sessionId as SessionIdentity
    return executeSend(requireSessionEntry(registry, identity), prompt)
  }

  return {
    execute: (command) => executeCommand(command, registry, start),
    subscribe: (session, onProjection) => {
      const entry = registry.get(keyOf(session))
      if (entry === undefined) {
        const unsubscribe = appServer.observe(session, onProjection)
        if (unsubscribe === undefined) throw new CodexSessionDriverError('missing-session')
        return unsubscribe
      }
      entry.listeners.add(onProjection)
      const unsubscribe: Unsubscribe = () => entry.listeners.delete(onProjection)
      return unsubscribe
    },
    close: () => {
      for (const entry of registry.values()) {
        const session = entry.actor.getSnapshot().context.sessionId
        if (session !== null) deps.sessionService.release(session)
        entry.actor.stop()
      }
      detach()
    },
    projections: appServer.projections,
    onRosterChanged: (listener) => {
      rosterListeners.add(listener)
      return () => rosterListeners.delete(listener)
    },
  }
}

export type CodexSessionAdapter = SessionAdapter & {
  close: () => void
  projections: () => readonly SessionProjection[]
  onRosterChanged: (listener: () => void) => () => void
}
