import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import {
  type ActorRefFrom,
  createActor,
  type EventFromLogic,
  fromCallback,
  fromPromise,
  setup,
  waitFor,
} from 'xstate'
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
import type { SessionStartInput } from '../../contract/session-start'
import { sessionSupervisorMachine } from './session-supervisor-machine'

const available = codexHarnessInfo(codexModelCatalogFixture())
if (available.availability !== 'available') throw new Error('Codex fixture must be available.')
const model = available.models[0]
if (model === undefined) throw new Error('Codex fixture needs a model.')
const catalog = harnessCatalogSchema.parse({ harnesses: [unavailable('claude'), available] })
const first: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'codex',
  projectId: '00000000-0000-4000-8000-000000000099',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  setup: { model: model.value, effort: model.defaultEffort, mode: 'workspace-write' },
}

async function supervisorForTest(request: CodexRequest) {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
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
  type CodexCall = Extract<EventFromLogic<typeof codexAppServerMachine>, { type: 'Call' }>
  const fakeCodex = fromCallback<CodexCall>(({ receive }) => {
    receive((event) => event.run(channel))
  })
  const machine = setup({
    types: {
      input: {} as { database: typeof database },
      context: {} as { database: typeof database },
      events: {} as { type: 'Shutdown' },
    },
    actors: {
      codex: fakeCodex,
      catalog: harnessCatalogMachine.provide({
        actors: { loadCatalog: fromPromise(async () => catalog) },
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
  const root = createActor(machine, { input: { database } }).start()
  const catalogActor = root.system.get('catalog') as
    | ActorRefFrom<typeof harnessCatalogMachine>
    | undefined
  const actor = root.system.get('sessions') as
    | ActorRefFrom<typeof sessionSupervisorMachine>
    | undefined
  if (catalogActor === undefined || actor === undefined)
    throw new Error('Test actors did not start.')
  catalogActor.send({ type: 'Catalog requested' })
  await waitFor(catalogActor, (snapshot) => snapshot.matches('Ready'))
  return { actor, root, client }
}

function start(actor: ActorRefFrom<typeof sessionSupervisorMachine>, input = first) {
  return new Promise<{ sessionId: string }>((resolve, reject) => {
    actor.send({ type: 'Start', input, reply: { resolve, reject } })
  })
}

test('models idle, running, and shutdown paths', async () => {
  const request: CodexRequest = async (_method, _params, parse) => parse({})
  const { actor, root, client } = await supervisorForTest(request)
  try {
    const paths = getShortestPaths(sessionSupervisorMachine, {
      input: actor.getSnapshot().context.services,
      events: (snapshot) => {
        if (snapshot.matches('Idle'))
          return [
            { type: 'Started' as const, commandId: first.commandId, sessionId: 'argo-1' },
            { type: 'Shutdown' as const },
          ]
        return snapshot.matches('Running') ? [{ type: 'Shutdown' as const }] : []
      },
    })
    assert.deepEqual(
      new Set(paths.map(({ state }) => String(state.value))),
      new Set(['Idle', 'Running', 'Closed']),
    )
    const running = paths.find(({ state }) => state.matches('Running'))?.state
    assert.deepEqual(running?.context.completed[first.commandId], { sessionId: 'argo-1' })
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('deduplicates one first command and owns its Session child', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start' ? { thread: { id: 'native-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const { actor, root, client } = await supervisorForTest(request)
  try {
    const [one, two] = await Promise.all([start(actor), start(actor)])
    assert.equal(two.sessionId, one.sessionId)
    assert.deepEqual(calls, ['thread/start', 'turn/start'])
    assert.equal((await start(actor)).sessionId, one.sessionId)
    const child = actor.getSnapshot().context.sessions[one.sessionId]
    assert.equal(child?.getSnapshot().matches('Ready'), true)
    root.send({ type: 'Shutdown' })
    assert.equal(child?.getSnapshot().status, 'stopped')
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('forwards a later send and rejects it after the child fails', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    if (method === 'turn/start' && calls.filter((call) => call === 'turn/start').length > 1)
      throw new Error('turn failed')
    return parse(
      method === 'thread/start' ? { thread: { id: 'native-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const { actor, root, client } = await supervisorForTest(request)
  try {
    const { sessionId } = await start(actor)
    await new Promise<{ sessionId: string }>((resolve, reject) => {
      actor.send({
        type: 'Send',
        input: { ...first, commandId: 'second', sessionId },
        reply: { resolve, reject },
      })
    })
    const child = actor.getSnapshot().context.sessions[sessionId]
    assert.ok(child)
    await waitFor(child, (snapshot) => snapshot.matches('Failed'))
    await assert.rejects(
      new Promise<{ sessionId: string }>((resolve, reject) => {
        actor.send({
          type: 'Send',
          input: { ...first, commandId: 'third', sessionId },
          reply: { resolve, reject },
        })
      }),
      /turn failed/,
    )
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('retains the vendor child and does not resend after persistence fails', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start' ? { thread: { id: 'native-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const { actor, root, client } = await supervisorForTest(request)
  try {
    client.exec('DROP TABLE session')
    await assert.rejects(start(actor), /Failed query/)
    assert.equal(
      actor.getSnapshot().context.failed[first.commandId]?.getSnapshot().matches('Failed'),
      true,
    )
    await assert.rejects(start(actor), /Failed query/)
    assert.deepEqual(calls, ['thread/start', 'turn/start'])
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
