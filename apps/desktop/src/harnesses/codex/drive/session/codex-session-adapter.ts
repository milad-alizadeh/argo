import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import type { AppServerSupervisorDeps } from '../supervision/app-server-supervisor-machine'
import type { CodexSessionAdapter } from './codex-session-adapter-contract'

export type { CodexSessionAdapter } from './codex-session-adapter-contract'

import {
  type CodexTurnSetup,
  codexOpeningSetupFor,
  codexTurnSetupSchemaFor,
} from '@/domains/sessions/contract/codex-turn-setup'
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

async function executeCodexCommand(options: {
  command: Parameters<CodexSessionAdapter['execute']>[0]
  appServer: ReturnType<typeof sharedAppServerRuntimeFor>
  registry: SessionRegistry
  start: (
    selection: WorkspaceSelection,
    prompt: string,
    setup: CodexTurnSetup,
  ) => Promise<SessionCommandOutcome>
}): Promise<SessionCommandOutcome> {
  const { command, appServer, registry, start } = options
  const startWithSetup = (selection: WorkspaceSelection, prompt: string, setup?: unknown) =>
    start(selection, prompt, setup as CodexTurnSetup)
  if (command.type !== 'session.start' && command.type !== 'session.send') {
    return executeCommand(command, registry, startWithSetup)
  }
  const catalog = await appServer.readModelCatalog()
  if (catalog === null) {
    return { kind: 'rejected', reason: 'Codex model catalog is unavailable.' }
  }
  const parsed = codexTurnSetupSchemaFor(catalog).safeParse(
    command.setup ?? codexOpeningSetupFor(catalog),
  )
  if (!parsed.success || parsed.data === undefined) {
    return { kind: 'rejected', reason: 'Codex does not support the selected Model and Effort.' }
  }
  return executeCommand({ ...command, setup: parsed.data }, registry, startWithSetup)
}

function createAdapterHistory(options: {
  supervisor: ReturnType<typeof sharedAppServerRuntimeFor>['supervisor']
  knownWorkspaces: (() => Promise<readonly { id: string; path: string }[]>) | undefined
  transcriptsRoot: string | undefined
  notify: () => void
}) {
  return createCodexSessionHistory({
    supervisor: options.supervisor,
    knownWorkspaces: options.knownWorkspaces ?? (async () => []),
    transcriptsRoot: options.transcriptsRoot,
    notify: options.notify,
  })
}

function createAdapterLaunch(options: {
  machine: ReturnType<typeof createManagedSessionMachine>
  appServer: ReturnType<typeof sharedAppServerRuntimeFor>
  registry: SessionRegistry
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
  sessionService: ManagedSessionDeps['sessionService']
  history: ReturnType<typeof createAdapterHistory>['history']
  notify: () => void
}) {
  return {
    machine: options.machine,
    register: (actor: ManagedSessionActor) =>
      registerCodexSessionActor({
        actor,
        appServer: options.appServer,
        registry: options.registry,
        notify: options.notify,
      }),
    registry: options.registry,
    resolveWorkspace: options.resolveWorkspace,
    supervisor: options.appServer.supervisor,
    sessionService: options.sessionService,
    history: options.history,
  }
}

function createHistoryReads(
  watched: ReturnType<typeof createAdapterHistory>['watched'],
  notify: () => void,
) {
  return {
    readHistoryProjection: (nativeId: string) => watched.readProjection(nativeId),
    watchedProjections: () => watched.projections(),
    checkoutFor: (nativeId: string) => watched.checkoutFor(nativeId),
    refreshSearchHistory: async () => {
      const projections = await watched.refreshForSearch()
      notify()
      return projections
    },
  }
}

function closeAdapter(options: {
  stopWatch: () => void
  launch: Parameters<typeof closeCodexSessionAdapter>[0]
  sessionService: ManagedSessionDeps['sessionService']
  detach: () => void
}) {
  return async () => {
    options.stopWatch()
    await closeCodexSessionAdapter(options.launch, options.sessionService, options.detach)
  }
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
  const { history, watched, stopWatch } = createAdapterHistory({
    supervisor,
    knownWorkspaces: deps.knownWorkspaces,
    transcriptsRoot: deps.transcriptsRoot,
    notify: rosterChanges.notify,
  })
  const launch = createAdapterLaunch({
    machine,
    appServer,
    registry,
    resolveWorkspace: deps.resolveWorkspace,
    sessionService: deps.sessionService,
    history,
    notify: rosterChanges.notify,
  })
  return {
    execute: (command) =>
      executeCodexCommand({
        command,
        appServer,
        registry,
        start: (selection, prompt, setup) =>
          startCodexSession({ launch, selection, prompt, setup }),
      }),
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
    close: closeAdapter({ stopWatch, launch, sessionService: deps.sessionService, detach }),
    projections: appServer.projections,
    readModelCatalog: appServer.readModelCatalog,
    refreshHistory: async (notifyLateSuccess) => {
      const projections = await watched.refresh()
      if (notifyLateSuccess()) rosterChanges.notify()
      return projections
    },
    ...createHistoryReads(watched, rosterChanges.notify),
    onRosterChanged: rosterChanges.subscribe,
  }
}
