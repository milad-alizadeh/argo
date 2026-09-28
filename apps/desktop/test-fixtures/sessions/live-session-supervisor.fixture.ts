// The live Session supervisor under a real catalog and an in-memory database, for its unit tests.
import { DatabaseSync } from 'node:sqlite'
import { type ActorRefFrom, createActor, fromPromise, waitFor, setup as xstateSetup } from 'xstate'
import { databaseFrom } from '@/database/database'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import {
  createLiveSessionSupervisorMachine,
  type LiveSessionSupervisorActor,
} from '@/domains/sessions/main/live/live-session-supervisor-machine'
import type {
  CodexAppServerClient,
  CodexRequest,
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { harnessCatalogSchema, unavailable } from '@/harnesses/harness-catalog'
import type { HarnessRegistration } from '@/harnesses/registration'
import { createHarnessRegistry } from '@/harnesses/registry'
import { harnessCatalogMachine } from '@/platform/main/harness-catalog/harness-catalog-machine'
import { codexModelCatalogFixture } from './codex-model-catalog.fixture'

export const available = codexHarnessInfo(codexModelCatalogFixture())
if (available.availability !== 'available') throw new Error('Codex fixture must be available.')
export const model = available.models[0]
if (model === undefined) throw new Error('Codex fixture needs a model.')
export const catalog = harnessCatalogSchema.parse({ harnesses: [unavailable('claude'), available] })
export const claudeCatalog = harnessCatalogSchema.parse({
  harnesses: [{ ...available, harness: 'claude' }, available],
})
export const first: SessionStartInput = {
  commandId: 'first-command',
  harness: 'codex',
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: model.value, effort: model.defaultEffort, mode: 'workspace-write' },
}
export const claudeFirst = { ...first, harness: 'claude' as const }
export const passiveChannelMethods = {
  interrupt: async () => {},
  answerPermission: async () => false,
  answerQuestion: async () => false,
  close: () => {},
}

export function createStartGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

export function successfulCodexRequest(nativeIdForStart: (count: number) => string) {
  let starts = 0
  const request: CodexRequest = async (method, _params, parse) => {
    if (method === 'thread/start') {
      starts += 1
      return parse({ thread: { id: nativeIdForStart(starts) } })
    }
    return parse({ turn: { id: 'turn-1' } })
  }
  return { request, starts: () => starts }
}

// Answers every Codex request on thread `native-1`, recording each method; `turnStart` may throw.
export function recordingCodexRequest(turnStart: (starts: number) => void = () => {}) {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    if (method === 'thread/start' || method === 'thread/resume')
      return parse({ thread: { id: 'native-1' } })
    turnStart(calls.filter((call) => call === 'turn/start').length)
    return parse({ turn: { id: `turn-${calls.length}` } })
  }
  return { calls, request }
}

export const codexClientFor = (
  request: CodexRequest,
  notifications: Set<(message: WireMessage) => boolean | undefined>,
): CodexAppServerClient => ({
  request: (method, params, parse) => request(method, params, parse),
  respond: () => {},
  onNotification: (listener) => {
    notifications.add(listener)
    return () => notifications.delete(listener)
  },
  shutdown: () => {},
})

export async function supervisorFor(
  request: CodexRequest,
  catalogValue = catalog,
  openClaude?: NonNullable<HarnessRegistration<'claude'>['openLiveSession']>,
) {
  const client = new DatabaseSync(':memory:')
  client.exec(
    'CREATE TABLE session (argo_id TEXT PRIMARY KEY, harness TEXT NOT NULL, native_id TEXT NOT NULL, project_id TEXT, workspace_id TEXT, custom_title TEXT, preview TEXT, first_prompt TEXT, cwd TEXT, activity_at INTEGER, subagents_read_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id); CREATE TABLE session_command (command_id TEXT PRIMARY KEY, intent_id TEXT, session_id TEXT, harness TEXT, native_id TEXT, turn_id TEXT, cwd TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0); CREATE UNIQUE INDEX session_command_intent ON session_command (intent_id); CREATE TABLE session_subagent (session_id TEXT NOT NULL, subagent_id TEXT NOT NULL, label TEXT, state TEXT NOT NULL, PRIMARY KEY (session_id, subagent_id));',
  )
  const database = databaseFrom(client)
  const notifications = new Set<(message: WireMessage) => boolean | undefined>()
  const codexClient = codexClientFor(request, notifications)
  const registry = createHarnessRegistry(codexClient)
  if (openClaude !== undefined) registry.claude.openLiveSession = openClaude
  const rootMachine = xstateSetup({
    types: {
      input: {} as { database: typeof database },
      context: {} as { database: typeof database },
      events: {} as { type: 'Shutdown' },
    },
    actors: {
      catalog: harnessCatalogMachine.provide({
        actors: { loadCatalog: fromPromise(async () => catalogValue) },
      }),
      sessions: createLiveSessionSupervisorMachine({
        database,
        registry,
      }),
    },
  }).createMachine({
    initial: 'Running',
    context: ({ input }) => ({ database: input.database }),
    states: {
      Running: {
        invoke: [
          { id: 'catalog', systemId: 'catalog', src: 'catalog' },
          {
            id: 'sessions',
            systemId: 'sessions',
            src: 'sessions',
          },
        ],
        on: { Shutdown: 'Closed' },
      },
      Closed: { type: 'final' },
    },
  })
  const root = createActor(rootMachine, { input: { database } }).start()
  const catalogActor = root.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine>
  const supervisor = root.system.get('sessions') as LiveSessionSupervisorActor
  catalogActor.send({ type: 'Catalog requested' })
  await waitFor(catalogActor, (snapshot) => snapshot.matches('Ready'))
  return {
    root,
    supervisor,
    client,
    notify(message: WireMessage) {
      for (const listener of notifications) listener(message)
    },
  }
}

export function start(
  actor: LiveSessionSupervisorActor,
  input: SessionStartInput,
  pendingId = 'optimistic:one',
) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({ type: 'Start', input, pendingId, reply: { resolve, reject } }),
  )
}

export function send(
  actor: LiveSessionSupervisorActor,
  input: SessionStartInput & { sessionId: string },
) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({
      type: 'Send',
      intentId: `optimistic:${input.commandId}`,
      input: {
        commandId: input.commandId,
        prompt: input.prompt,
        attachments: input.attachments,
        turnConfiguration: input.turnConfiguration,
        sessionId: input.sessionId,
        resume: {
          harness: input.harness,
          nativeId: 'native-1',
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          cwd: input.cwd,
        },
      },
      reply: { resolve, reject },
    }),
  )
}

export function completeCodexTurn(notify: (message: WireMessage) => void, turnId: string) {
  notify({
    method: 'turn/completed',
    params: { threadId: 'native-1', turn: { id: turnId, status: 'completed' } },
  })
}

export const commandStatus = (client: DatabaseSync, commandId: string) =>
  client.prepare('SELECT status FROM session_command WHERE command_id = ?').get(commandId)?.status
