import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type { Unsubscribe } from '@/domains/sessions/next/contract/session-projection-contract'
import type { AppServerSupervisorDeps } from '@/harnesses/codex/drive/app-server-supervisor-machine'
import type { CodexSessionAdapter } from '@/harnesses/codex/drive/codex-session-adapter-contract'

export type { CodexSessionAdapter } from '@/harnesses/codex/drive/codex-session-adapter-contract'

import { closeCodexSessionAdapter } from '@/harnesses/codex/drive/codex-session-adapter-close'
import {
  executeCommand,
  type SessionRegistry,
} from '@/harnesses/codex/drive/codex-session-commands'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error'
import { resumeCodexSession, startCodexSession } from '@/harnesses/codex/drive/codex-session-launch'
import type { ManagedSessionActor } from '@/harnesses/codex/drive/codex-session-projection'
import { projectionFrom } from '@/harnesses/codex/drive/codex-session-projection'
import { sharedAppServerRuntimeFor } from '@/harnesses/codex/drive/codex-shared-app-server-runtime'
import type { ManagedSessionDeps } from '@/harnesses/codex/drive/managed-session-machine'
import { createManagedSessionMachine } from '@/harnesses/codex/drive/managed-session-machine'
import { createWatchedChanges } from '@/harnesses/composition/watched-changes'

function keyOf(session: SessionIdentity): string {
  return `${session.harness}:${session.nativeId}`
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

export function createCodexSessionAdapter(deps: {
  findExecutable: AppServerSupervisorDeps['findExecutable']
  sessionService: ManagedSessionDeps['sessionService']
  waitForWorkspaceReady: ManagedSessionDeps['waitForWorkspaceReady']
  now: ManagedSessionDeps['now']
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
}): CodexSessionAdapter {
  const registry: SessionRegistry = new Map()
  const rosterChanges = createWatchedChanges()
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
        entry = { actor, revision: 0, listeners: new Set(), sendQueue: Promise.resolve() }
        registry.set(key, entry)
      }
      entry.revision += 1
      const projection = projectionFrom(snapshot, entry.revision)
      appServer.publish(projection)
      rosterChanges.notify()
      for (const listener of entry.listeners) listener(projection)
    }
    actor.subscribe(notify)
    notify(actor.getSnapshot())
  }
  const launch = {
    machine,
    register: registerOnceIdentified,
    registry,
    resolveWorkspace: deps.resolveWorkspace,
    supervisor,
  }
  return {
    execute: (command) =>
      executeCommand(command, registry, (selection, prompt) =>
        startCodexSession(launch, selection, prompt),
      ),
    resume: (request) => resumeCodexSession(launch, request),
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
    close: () => closeCodexSessionAdapter(registry, deps.sessionService, detach),
    projections: appServer.projections,
    onRosterChanged: rosterChanges.subscribe,
  }
}
