import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { type ActorRefFrom, createActor, fromCallback, fromPromise, setup, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import {
  harnessCatalogMachine,
  harnessCatalogSchema,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'
import type {
  CodexChannel,
  CodexRequest,
  codexAppServerMachine,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { codexModelCatalogFixture } from '../../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import type { SessionStartInput } from '../api/session-start'
import { sessionSupervisorMachine } from './session-supervisor-machine'

const available = codexHarnessInfo(codexModelCatalogFixture())
if (available.availability !== 'available') throw new Error('Codex fixture must be available.')
const model = available.models[0]
if (model === undefined) throw new Error('Codex fixture needs a model.')
const catalog = harnessCatalogSchema.parse({ harnesses: [unavailable('claude'), available] })
const first: SessionStartInput = {
  commandId: 'first-command',
  harness: 'codex',
  projectId: 'project-1',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  setup: { model: model.value, effort: model.defaultEffort, mode: 'workspace-write' },
}

async function supervisorFor(request: CodexRequest, catalogValue = catalog) {
  const client = new DatabaseSync(':memory:')
  client.exec(
    'CREATE TABLE session (argo_id TEXT PRIMARY KEY, harness TEXT NOT NULL, native_id TEXT NOT NULL, project_id TEXT NOT NULL, first_prompt TEXT, updated_at INTEGER NOT NULL); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);',
  )
  const database = createDurableDatabase(client)
  const channel: CodexChannel = {
    request: (method, params, parse) => request(method, params, parse),
    invalidMessageCount: () => 0,
    notify: () => {},
    respond: () => {},
    onNotification: () => {},
    onExit: () => {},
    close: () => {},
  }
  type Call = Extract<
    Parameters<ActorRefFrom<typeof codexAppServerMachine>['send']>[0],
    { type: 'Call' }
  >
  const rootMachine = setup({
    types: {
      input: {} as { database: typeof database },
      context: {} as { database: typeof database },
      events: {} as { type: 'Shutdown' },
    },
    actors: {
      codex: fromCallback<Call>(({ receive }) => receive((event) => event.run(channel))),
      catalog: harnessCatalogMachine.provide({
        actors: { loadCatalog: fromPromise(async () => catalogValue) },
      }),
      sessions: sessionSupervisorMachine,
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
            input: ({ context }) => ({ database: context.database }),
          },
        ],
        on: { Shutdown: 'Closed' },
      },
      Closed: { type: 'final' },
    },
  })
  const root = createActor(rootMachine, { input: { database } }).start()
  const catalogActor = root.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine>
  const supervisor = root.system.get('sessions') as ActorRefFrom<typeof sessionSupervisorMachine>
  catalogActor.send({ type: 'Catalog requested' })
  await waitFor(catalogActor, (snapshot) => snapshot.matches('Ready'))
  return { root, supervisor, client }
}

function start(
  actor: ActorRefFrom<typeof sessionSupervisorMachine>,
  input: SessionStartInput,
  pendingId = 'optimistic:one',
) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({ type: 'Start', input, pendingId, reply: { resolve, reject } }),
  )
}

function send(
  actor: ActorRefFrom<typeof sessionSupervisorMachine>,
  input: SessionStartInput & { sessionId: string },
) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({ type: 'Send', input, reply: { resolve, reject } }),
  )
}

test('models supervisor lifetime', () => {
  const paths = getShortestPaths(sessionSupervisorMachine, {
    input: { database: {} as never },
    events: (state) => (state.matches('Running') ? [{ type: 'Shutdown' as const }] : []),
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => String(state.value))),
    new Set(['Running', 'Closed']),
  )
})

test('rejects a model mode that the catalog does not support before calling Codex', async () => {
  let called = false
  const restrictedCatalog = harnessCatalogSchema.parse({
    harnesses: [
      unavailable('claude'),
      {
        ...available,
        models: [{ ...model, supportedModes: ['workspace-write'] }],
      },
    ],
  })
  const { root, supervisor, client } = await supervisorFor(async () => {
    called = true
    throw new Error('Codex must not be called.')
  }, restrictedCatalog)
  try {
    await assert.rejects(
      start(supervisor, { ...first, setup: { ...first.setup, mode: 'read-only' } }),
      /no longer available/,
    )
    assert.equal(called, false)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('cancels an unsettled start when its supervisor stops', async () => {
  const never = new Promise<never>(() => {})
  const { root, supervisor, client } = await supervisorFor(async (method, _params, parse) => {
    if (method === 'thread/start') return parse({ thread: { id: 'native-1' } })
    return never
  })
  try {
    const pending = start(supervisor, first)
    root.send({ type: 'Shutdown' })
    await assert.rejects(pending, /supervisor is closed/)
  } finally {
    client.close()
  }
})

test('rejects a changed Codex stance instead of silently retaining the opening stance', async () => {
  let calls = 0
  const { root, supervisor, client } = await supervisorFor(async (method, _params, parse) => {
    calls += 1
    return parse(
      method === 'thread/start' ? { thread: { id: 'native-1' } } : { turn: { id: 'turn-1' } },
    )
  })
  try {
    const { sessionId } = await start(supervisor, first)
    const child = supervisor.getSnapshot().context.sessions[sessionId]
    assert.ok(child)
    await waitFor(child, (snapshot) => snapshot.matches('Ready'))
    await assert.rejects(
      send(supervisor, {
        ...first,
        commandId: 'changed-stance',
        sessionId,
        setup: { ...first.setup, mode: 'read-only' },
      }),
      /requires starting a new Session/,
    )
    assert.equal(calls, 2)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('queues a distinct startup command and settles both calls after persistence', async () => {
  const turns: string[] = []
  let releaseFirst!: () => void
  const firstTurn = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const request: CodexRequest = async (method, params, parse) => {
    if (method === 'thread/start') return parse({ thread: { id: 'native-1' } })
    turns.push(((params as { input: Array<{ text: string }> }).input[0] as { text: string }).text)
    if (turns.length === 1) await firstTurn
    return parse({ turn: { id: `turn-${turns.length}` } })
  }
  const { root, supervisor, client } = await supervisorFor(request)
  try {
    const one = start(supervisor, first)
    const two = start(supervisor, { ...first, commandId: 'second-command', prompt: 'second' })
    releaseFirst()
    const [firstResult, secondResult] = await Promise.all([one, two])
    assert.equal(secondResult.sessionId, firstResult.sessionId)
    const child = supervisor.getSnapshot().context.sessions[firstResult.sessionId]
    assert.ok(child)
    await waitFor(child, (snapshot) => snapshot.matches('Ready'))
    assert.deepEqual(turns, ['first', 'second'])
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('settles start before a queued turn fails', async () => {
  let turns = 0
  let releaseFirst!: () => void
  const firstTurn = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const request: CodexRequest = async (method, _params, parse) => {
    if (method === 'thread/start') return parse({ thread: { id: 'native-1' } })
    turns += 1
    if (turns === 1) await firstTurn
    if (turns === 2) throw new Error('second turn failed')
    return parse({ turn: { id: 'turn-1' } })
  }
  const { root, supervisor, client } = await supervisorFor(request)
  try {
    const firstStart = start(supervisor, first)
    const queuedStart = start(supervisor, {
      ...first,
      commandId: 'second-command',
      prompt: 'second',
    })
    releaseFirst()
    const [firstResult, queuedResult] = await Promise.all([firstStart, queuedStart])
    assert.ok(firstResult.sessionId)
    assert.equal(queuedResult.sessionId, firstResult.sessionId)
    const child = supervisor.getSnapshot().context.sessions[firstResult.sessionId]
    assert.ok(child)
    await waitFor(child, (snapshot) => snapshot.matches('Failed'))
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
