import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { AppServerSupervisorDeps } from '../supervision/app-server-supervisor-machine'
import type { CodexSessionAdapter } from './codex-session-adapter-contract'

export type { CodexSessionAdapter } from './codex-session-adapter-contract'

import { createWatchedChanges } from '@/harnesses/composition/watched-changes'
import { closeCodexSessionAdapter } from '../codex-session-adapter-close'
import { sharedAppServerRuntimeFor } from '../supervision/codex-shared-app-server-runtime'
import type { ManagedSessionDeps } from '../supervision/managed-session-machine'
import { createManagedSessionMachine } from '../supervision/managed-session-machine'
import { executeCommand, type SessionRegistry } from './codex-session-commands'
import { CodexSessionDriverError } from './codex-session-error'
import { createCodexSessionHistory } from './codex-session-history'
import { resumeCodexSession, startCodexSession } from './codex-session-launch'
import type { ManagedSessionActor } from './codex-session-projection'
import { registerCodexSessionActor, subscribeToCodexSession } from './codex-session-registration'

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
  knownWorkspaces?: () => Promise<readonly { id: string; path: string }[]>
  transcriptsRoot?: string
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
  const { history, watched, stopWatch } = createCodexSessionHistory({
    supervisor,
    knownWorkspaces: deps.knownWorkspaces ?? (async () => []),
    transcriptsRoot: deps.transcriptsRoot,
    notify: rosterChanges.notify,
  })
  const launch = {
    machine,
    register: (actor: ManagedSessionActor) =>
      registerCodexSessionActor({ actor, appServer, registry, notify: rosterChanges.notify }),
    registry,
    resolveWorkspace: deps.resolveWorkspace,
    supervisor,
    sessionService: deps.sessionService,
    history,
  }
  return {
    execute: (command) =>
      executeCommand(command, registry, (selection, prompt) =>
        startCodexSession(launch, selection, prompt),
      ),
    resume: (request) => resumeCodexSession(launch, request),
    subscribe: (session, onProjection) => {
      const unsubscribe = subscribeToCodexSession({
        session: { harness: 'codex', nativeId: session.nativeId },
        onProjection,
        registry,
        appServer,
      })
      if (unsubscribe === undefined) throw new CodexSessionDriverError('missing-session')
      return unsubscribe
    },
    close: () => {
      stopWatch()
      closeCodexSessionAdapter(registry, deps.sessionService, detach)
    },
    projections: appServer.projections,
    refreshHistory: () => watched.refresh(),
    watchedProjections: () => watched.projections(),
    checkoutFor: (nativeId: string) => watched.checkoutFor(nativeId),
    onRosterChanged: rosterChanges.subscribe,
  }
}
