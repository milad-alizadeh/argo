import { DatabaseSync } from 'node:sqlite'
import {
  type ActorRefFrom,
  createActor,
  fromCallback,
  fromPromise,
  waitFor,
  setup as xstateSetup,
} from 'xstate'
import { databaseFrom } from '@/database/database'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import {
  createLiveSessionSupervisorMachine,
  type LiveSessionSupervisorActor,
} from '@/domains/sessions/main/live/live-session-supervisor-machine'
import {
  harnessCatalogMachine,
  harnessCatalogSchema,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'
import type {
  CodexAppServerClient,
  CodexRequest,
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import type { HarnessRegistration } from '@/harnesses/registration'
import { createHarnessRegistry } from '@/harnesses/registry'
import type { codexAppServerMachine } from '@/platform/main/application/codex-app-server-machine'
import { codexModelCatalogFixture } from './codex-model-catalog.fixture'

// A live Session supervisor over an in-memory index, with a scripted Codex app-server.

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
    'CREATE TABLE session (argo_id TEXT PRIMARY KEY, harness TEXT NOT NULL, native_id TEXT NOT NULL, project_id TEXT, workspace_id TEXT, custom_title TEXT, preview TEXT, first_prompt TEXT, cwd TEXT, activity_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id); CREATE TABLE session_command (command_id TEXT PRIMARY KEY, intent_id TEXT, session_id TEXT, harness TEXT, native_id TEXT, turn_id TEXT, cwd TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0); CREATE UNIQUE INDEX session_command_intent ON session_command (intent_id);',
  )
  const database = databaseFrom(client)
  const notifications = new Set<(message: WireMessage) => boolean | undefined>()
  const codexClient = codexClientFor(request, notifications)
  type Call = Extract<
    Parameters<ActorRefFrom<typeof codexAppServerMachine>['send']>[0],
    { type: 'Call' }
  >
  const registry = createHarnessRegistry(codexClient)
  if (openClaude !== undefined) registry.claude.openLiveSession = openClaude
  const rootMachine = xstateSetup({
    types: {
      input: {} as { database: typeof database },
      context: {} as { database: typeof database },
      events: {} as { type: 'Shutdown' },
    },
    actors: {
      codex: fromCallback<Call>(({ receive }) => receive((event) => event.run(codexClient))),
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
          { id: 'codex', systemId: 'codex', src: 'codex' },
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
