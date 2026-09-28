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
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import type { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import type { HarnessRegistration } from '@/harnesses/registration'
import { createHarnessRegistry } from '@/harnesses/registry'
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
const claudeCatalog = harnessCatalogSchema.parse({
  harnesses: [{ ...available, harness: 'claude' }, available],
})
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
const claudeFirst = { ...first, harness: 'claude' as const }
const passiveChannelMethods = {
  interrupt: async () => {},
  answerPermission: async () => false,
  answerQuestion: async () => false,
  close: () => {},
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

const codexClientFor = (
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

async function supervisorFor(
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
  const registry = createHarnessRegistry(request)
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
    notify: (message: WireMessage) => {
      for (const listener of notifications) listener(message)
    },
  }
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

function completeCodexTurn(notify: (message: WireMessage) => void, turnId: string) {
  notify({
    method: 'turn/completed',
    params: { threadId: 'native-1', turn: { id: turnId, status: 'completed' } },
  })
}

const commandStatus = (client: DatabaseSync, commandId: string) =>
  client.prepare('SELECT status FROM session_command WHERE command_id = ?').get(commandId)?.status

test('models supervisor lifetime', () => {
  const paths = getShortestPaths(
    createLiveSessionSupervisorMachine({
      database: {} as never,
      registry: createHarnessRegistry(async () => {
        throw new Error('Unused request.')
      }),
    }),
    {
      events: (state) => (state.matches('Running') ? [{ type: 'Shutdown' as const }] : []),
    },
  )
  assert.deepEqual(
    new Set(paths.map(({ state }) => String(state.value))),
    new Set(['Running', 'Closed']),
  )
})

test('binds a delayed Claude identity once and never repeats a command ID', async () => {
  let openCount = 0
  let laterSubmissions = 0
  let identify!: () => void
  const { root, supervisor, client } = await supervisorFor(
    async () => {
      throw new Error('Codex must not be called.')
    },
    claudeCatalog,
    (input, _controls, emit) => {
      openCount += 1
      identify = () => {
        emit({ type: 'identity', nativeId: 'native-1' })
        emit({ type: 'turn.completed', commandId: input.commandId })
      }
      return {
        submit: async (command) => {
          laterSubmissions += 1
          emit({ type: 'turn.completed', commandId: command.commandId })
        },
        ...passiveChannelMethods,
      }
    },
  )
  try {
    const pending = start(supervisor, claudeFirst)
    assert.equal(openCount, 1)
    identify()
    const { sessionId } = await pending
    assert.equal((await start(supervisor, claudeFirst)).sessionId, sessionId)
    assert.equal(openCount, 1)
    const later = { ...claudeFirst, sessionId, commandId: 'later-command', prompt: 'later' }
    await send(supervisor, later)
    const liveActor = liveSessionActorFor(supervisor, sessionId)
    assert.ok(liveActor)
    await waitFor(liveActor, (snapshot) => snapshot.matches('Ready'))
    await send(supervisor, later)
    assert.equal(laterSubmissions, 1)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})

test('resumes a persisted Claude Session after its live channel fails', async () => {
  let failFirst!: () => void
  let identifyRetry!: () => void
  let openings = 0
  let queuedSubmissions = 0
  const { root, supervisor, client } = await supervisorFor(
    async () => {
      throw new Error('Codex must not be called.')
    },
    claudeCatalog,
    (input, _controls, emit) => {
      openings += 1
      const identify = () => {
        emit({ type: 'identity', nativeId: 'native-1' })
        emit({ type: 'turn.completed', commandId: input.commandId })
      }
      if (openings === 1) {
        identify()
        failFirst = () => emit({ type: 'closed' })
      } else identifyRetry = identify
      return {
        submit: async (command) => {
          queuedSubmissions += 1
          emit({ type: 'turn.completed', commandId: command.commandId })
        },
        ...passiveChannelMethods,
      }
    },
  )
  try {
    const { sessionId } = await start(supervisor, claudeFirst)
    const firstActor = liveSessionActorFor(supervisor, sessionId)
    assert.ok(firstActor)
    failFirst()
    await waitFor(firstActor, (snapshot) => snapshot.matches('Failed'))
    const retry = { ...claudeFirst, sessionId, commandId: 'retry-command', prompt: 'retry' }
    const retried = send(supervisor, retry)
    const queued = { ...retry, commandId: 'queued-command', prompt: 'queued' }
    assert.equal((await send(supervisor, queued)).sessionId, sessionId)
    identifyRetry()
    assert.equal((await retried).sessionId, sessionId)
    assert.equal(openings, 2)
    const resumed = liveSessionActorFor(supervisor, sessionId)
    assert.ok(resumed)
    assert.notEqual(resumed, firstActor)
    await waitFor(resumed, (snapshot) => snapshot.matches('Ready'))
    assert.equal(queuedSubmissions, 1)
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
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
  const { root, supervisor, client, notify } = await supervisorFor(
    async (method, _params, parse) => {
      calls += 1
      return parse(
        method === 'thread/start' ? { thread: { id: 'native-1' } } : { turn: { id: 'turn-1' } },
      )
    },
  )
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
    await waitFor(child, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-1')
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
    const result = await start(
      supervisor,
      { ...first, commandId: 'retry-command' },
      'optimistic:one:2',
    )
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

test('retiring an idle actor keeps the Session identity and the next send resumes it', async () => {
  const calls: string[] = []
  const { root, supervisor, client, notify } = await supervisorFor(
    async (method, _params, parse) => {
      calls.push(method)
      if (method === 'thread/start' || method === 'thread/resume')
        return parse({ thread: { id: 'native-1' } })
      return parse({ turn: { id: `turn-${calls.length}` } })
    },
  )
  try {
    const { sessionId } = await start(supervisor, first)
    const actor = liveSessionActorFor(supervisor, sessionId)
    assert.ok(actor)
    await waitFor(actor, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-2')
    await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
    assert.equal(commandStatus(client, first.commandId), 'completed')
    const actorId = supervisor.getSnapshot().context.sessions[sessionId]
    assert.ok(actorId)
    supervisor.send({ type: 'Retire session', actorId, sessionId })
    await waitFor(supervisor, (snapshot) => snapshot.context.sessions[sessionId] === undefined)
    assert.equal(liveSessionActorFor(supervisor, sessionId), undefined)
    assert.equal(
      client.prepare('SELECT native_id FROM session WHERE argo_id = ?').get(sessionId)?.native_id,
      'native-1',
    )
    await send(supervisor, { ...first, sessionId, commandId: 'second-command', prompt: 'second' })
    const resumed = liveSessionActorFor(supervisor, sessionId)
    assert.ok(resumed)
    await waitFor(resumed, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-4')
    await waitFor(resumed, (snapshot) => snapshot.matches('Ready'))
    assert.equal(commandStatus(client, 'second-command'), 'completed')
    const resumedActorId = supervisor.getSnapshot().context.sessions[sessionId]
    assert.ok(resumedActorId)
    supervisor.send({ type: 'Retire session', actorId: resumedActorId, sessionId })
    await waitFor(supervisor, (snapshot) => snapshot.context.sessions[sessionId] === undefined)
    await send(supervisor, { ...first, sessionId, commandId: 'third-command', prompt: 'third' })
    assert.deepEqual(calls, [
      'thread/start',
      'turn/start',
      'thread/resume',
      'turn/start',
      'thread/resume',
      'turn/start',
    ])
  } finally {
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
