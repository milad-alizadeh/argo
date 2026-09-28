import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import {
  type ActorRefFrom,
  createActor,
  fromCallback,
  fromPromise,
  waitFor,
  setup as xstateSetup,
} from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { databaseFrom } from '@/database/database'
import {
  harnessCatalogMachine,
  harnessCatalogSchema,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'
import type {
  CodexAppServerClient,
  CodexRequest,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import type { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { codexModelCatalogFixture } from '../../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import type { SessionStartInput } from '../api/session-submit'
import {
  createLiveSessionSupervisorMachine,
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
} from './live-session-supervisor-machine'

const available = codexHarnessInfo(codexModelCatalogFixture())
if (available.availability !== 'available') throw new Error('Codex fixture must be available.')
const model = available.models[0]
if (model === undefined) throw new Error('Codex fixture needs a model.')
const catalog = harnessCatalogSchema.parse({ harnesses: [unavailable('claude'), available] })
const first: SessionStartInput = {
  commandId: 'first-command',
  harness: 'codex',
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: model.value, effort: model.defaultEffort, mode: 'workspace-write' },
}

function createStartGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function successfulCodexRequest(nativeIdForStart: (count: number) => string) {
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

async function supervisorFor(request: CodexRequest, catalogValue = catalog) {
  const client = new DatabaseSync(':memory:')
  client.exec(
    'CREATE TABLE session (argo_id TEXT PRIMARY KEY, harness TEXT NOT NULL, native_id TEXT NOT NULL, project_id TEXT, workspace_id TEXT, custom_title TEXT, preview TEXT, first_prompt TEXT, cwd TEXT, activity_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);',
  )
  const database = databaseFrom(client)
  const codexClient: CodexAppServerClient = {
    request: (method, params, parse) => request(method, params, parse),
    respond: () => {},
    onNotification: () => () => {},
    shutdown: () => {},
  }
  type Call = Extract<
    Parameters<ActorRefFrom<typeof codexAppServerMachine>['send']>[0],
    { type: 'Call' }
  >
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
      sessions: createLiveSessionSupervisorMachine({ database }),
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
  return { root, supervisor, client }
}

function start(
  actor: LiveSessionSupervisorActor,
  input: SessionStartInput,
  pendingId = 'optimistic:one',
) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({ type: 'Start', input, pendingId, reply: { resolve, reject } }),
  )
}

function send(actor: LiveSessionSupervisorActor, input: SessionStartInput & { sessionId: string }) {
  return new Promise<{ sessionId: string }>((resolve, reject) =>
    actor.send({
      type: 'Send',
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

test('models supervisor lifetime', () => {
  const paths = getShortestPaths(createLiveSessionSupervisorMachine({ database: {} as never }), {
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
      start(supervisor, {
        ...first,
        turnConfiguration: { ...first.turnConfiguration, mode: 'read-only' },
      }),
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
    assert.deepEqual(
      Object.assign(
        {},
        client
          .prepare(
            'SELECT argo_id, project_id, workspace_id, first_prompt, cwd FROM session WHERE argo_id = ?',
          )
          .get(sessionId),
      ),
      {
        argo_id: sessionId,
        project_id: 'project-1',
        workspace_id: 'workspace-1',
        first_prompt: 'first',
        cwd: '/repo',
      },
    )
    await waitFor(supervisor, (snapshot) => snapshot.context.sessions[sessionId] !== undefined)
    const child = liveSessionActorFor(supervisor, sessionId)
    assert.ok(child)
    await waitFor(child, (snapshot) => snapshot.matches('Ready'))
    await assert.rejects(
      send(supervisor, {
        ...first,
        commandId: 'changed-stance',
        sessionId,
        turnConfiguration: { ...first.turnConfiguration, mode: 'read-only' },
      }),
      /requires starting a new Session/,
    )
    assert.equal(calls, 2)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('the same in-flight command shares one vendor Session result', async () => {
  let starts = 0
  const startGate = createStartGate()
  const { root, supervisor, client } = await supervisorFor(async (method, _params, parse) => {
    if (method === 'thread/start') {
      starts += 1
      await startGate.promise
      return parse({ thread: { id: 'native-1' } })
    }
    return parse({ turn: { id: 'turn-1' } })
  })
  try {
    const one = start(supervisor, first)
    const two = start(supervisor, first)
    startGate.release()
    const [firstResult, secondResult] = await Promise.all([one, two])
    assert.equal(secondResult.sessionId, firstResult.sessionId)
    assert.equal(starts, 1)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('the first Send after restart resumes the stored Codex thread before starting its Turn', async () => {
  const calls: Array<{ method: string; threadId: string | undefined; sandbox?: string }> = []
  const { root, supervisor, client } = await supervisorFor(async (method, params, parse) => {
    const requestParams = params as { threadId?: string; sandbox?: string }
    calls.push({
      method,
      threadId: requestParams.threadId,
      ...(requestParams.sandbox === undefined ? {} : { sandbox: requestParams.sandbox }),
    })
    if (method === 'thread/resume') return parse({ thread: { id: requestParams.threadId } })
    return parse({ turn: { id: 'turn-1' } })
  })
  try {
    await assert.doesNotReject(
      send(supervisor, {
        ...first,
        sessionId: 'session-1',
        turnConfiguration: { ...first.turnConfiguration, mode: 'read-only' },
      }),
    )
    assert.deepEqual(calls, [
      { method: 'thread/resume', threadId: 'native-1', sandbox: 'read-only' },
      { method: 'turn/start', threadId: 'native-1' },
    ])
    await waitFor(supervisor, (snapshot) => snapshot.context.sessions['session-1'] !== undefined)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('rejects a different command for an in-flight draft without sending a Turn', async () => {
  const turns: string[] = []
  const startGate = createStartGate()
  const { root, supervisor, client } = await supervisorFor(async (method, _params, parse) => {
    if (method === 'thread/start') {
      await startGate.promise
      return parse({ thread: { id: 'native-1' } })
    }
    turns.push(method)
    return parse({ turn: { id: 'turn-1' } })
  })
  try {
    const one = start(supervisor, first)
    const two = start(supervisor, { ...first, commandId: 'second-command', prompt: 'second' })
    await assert.rejects(two, /conflicting start/)
    startGate.release()
    await one
    assert.equal(turns.filter((method) => method === 'turn/start').length, 1)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('completed draft revisions replay only their command and isolate newer prompts', async () => {
  const request = successfulCodexRequest((count) => `native-${count}`)
  const { root, supervisor, client } = await supervisorFor(request.request)
  try {
    const accepted = await start(supervisor, first, 'optimistic:one:1')
    const replay = await start(supervisor, first, 'optimistic:one:1')
    assert.equal(replay.sessionId, accepted.sessionId)
    await assert.rejects(
      start(supervisor, { ...first, commandId: 'different-command' }, 'optimistic:one:1'),
      /conflicting start already completed/,
    )
    const original = await start(supervisor, first, 'optimistic:one:1')
    const newer = await start(
      supervisor,
      { ...first, commandId: 'newer-command', prompt: 'newer draft' },
      'optimistic:one:2',
    )
    assert.equal(original.sessionId, accepted.sessionId)
    assert.notEqual(newer.sessionId, original.sessionId)
    assert.equal(request.starts(), 2)
    assert.equal(
      client.prepare('SELECT first_prompt FROM session WHERE argo_id = ?').get(newer.sessionId)
        ?.first_prompt,
      'newer draft',
    )
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('allows an explicit retry after the Harness fails before returning a native id', async () => {
  let starts = 0
  const { root, supervisor, client } = await supervisorFor(async (method, _params, parse) => {
    if (method !== 'thread/start') return parse({ turn: { id: 'turn-1' } })
    starts += 1
    if (starts === 1) throw new Error('Harness failed before start.')
    return parse({ thread: { id: 'native-1' } })
  })
  try {
    await assert.rejects(start(supervisor, first), /Harness failed before start/)
    const result = await start(supervisor, { ...first, commandId: 'retry-command' })
    assert.ok(result.sessionId)
    assert.equal(starts, 2)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('does not retry a vendor Session automatically when the real SQLite upsert fails', async () => {
  const request = successfulCodexRequest(() => 'native-1')
  const { root, supervisor, client } = await supervisorFor(request.request)
  client.exec(
    "CREATE TRIGGER reject_session_insert BEFORE INSERT ON session BEGIN SELECT RAISE(ABORT, 'session insert rejected'); END;",
  )
  try {
    await assert.rejects(start(supervisor, first), /Failed query/)
    await assert.rejects(
      start(supervisor, { ...first, commandId: 'retry-command' }),
      /conflicting start already completed/,
    )
    assert.equal(request.starts(), 1)
    assert.equal(client.prepare('SELECT COUNT(*) AS count FROM session').get()?.count, 0)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
