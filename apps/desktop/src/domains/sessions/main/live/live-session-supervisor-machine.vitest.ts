import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { ACP_HARNESSES } from '@/harnesses/acp/acp-agents'
import { acpExecutableOverride } from '@/harnesses/acp/acp-proof-protocol'
import { createAcpRegistrations } from '@/harnesses/acp/acp-registration-factory'
import { harnessCatalogSchema, unavailable } from '@/harnesses/harness-catalog'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { createHarnessRegistry } from '@/harnesses/registry'
import { waitForMockAcpEvent } from '@/mocks/cli/claude-acp/mock-acp-session'
import { writeMockClaudeAcp } from '@/mocks/cli/claude-acp/mock-claude-acp-cli'
import {
  available,
  claudeCatalog,
  claudeFirst,
  codexClientFor,
  completeCodexTurn,
  createStartGate,
  first,
  model,
  passiveChannelMethods,
  send,
  start,
  successfulCodexRequest,
  supervisorFor,
} from '@/mocks/sessions/live-session-supervisor.fixture'
import {
  createLiveSessionSupervisorMachine,
  liveSessionActorFor,
  SessionSubmitRejectedError,
} from './live-session-supervisor-machine'

const harnessStartFailed = (error: unknown) =>
  error instanceof SessionSubmitRejectedError && error.message === 'harness-start-failed'

test('models supervisor lifetime', () => {
  const paths = getShortestPaths(
    createLiveSessionSupervisorMachine({
      database: {} as never,
      registry: createHarnessRegistry(
        codexClientFor(async () => {
          throw new Error('Unused request.')
        }, new Set()),
      ),
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

test('rejects a model mode that the catalog does not support before calling Codex', async () => {
  let called = false
  const restrictedCatalog = harnessCatalogSchema.parse({
    harnesses: [
      unavailable('claude'),
      {
        ...available,
        models: [{ ...model, supportedModes: ['workspace-write'] }],
      },
      ...ACP_HARNESSES.map((harness) => unavailable(harness)),
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

test('starts an ACP Session when the agent reports no mode or effort choice', async () => {
  const [harness] = ACP_HARNESSES
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-acp-supervisor-'))
  const override = acpExecutableOverride(harness)
  try {
    process.env[override] = await writeMockClaudeAcp(folder, path.join(folder, 'transcripts'))
    process.env.MOCK_ACP_OMITTED_OPTIONS = 'mode,thought_level'
    const info = await createAcpRegistrations()[harness].readCatalog()
    if (info.availability !== 'available') throw new Error('The ACP catalog is unavailable.')
    const acpCatalog = harnessCatalogSchema.parse({
      harnesses: [
        unavailable('claude'),
        available,
        ...ACP_HARNESSES.map((each) => (each === harness ? info : unavailable(each))),
      ],
    })
    const { root, supervisor, registry, client } = await supervisorFor(async () => {
      throw new Error('Codex must not be called.')
    }, acpCatalog)
    // The agent writes into the folder until its channel closes, so removal waits for that.
    const events: LiveSessionChannelEvent[] = []
    const open = registry[harness].openLiveSession
    assert.ok(open)
    registry[harness].openLiveSession = (input, controls, emit) =>
      open(input, controls, (event) => {
        events.push(event)
        emit(event)
      })
    try {
      const { sessionId } = await start(supervisor, {
        ...first,
        harness,
        cwd: folder,
        turnConfiguration: info.opening,
      })
      assert.ok(sessionId)
    } finally {
      root.send({ type: 'Shutdown' })
      client.close()
      await waitForMockAcpEvent(events, 'closed')
    }
  } finally {
    delete process.env[override]
    delete process.env.MOCK_ACP_OMITTED_OPTIONS
    // Shutdown does not wait for the mock agent, which can still be writing its transcript.
    await rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
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
            'SELECT argo_id, project_id, worktree_path, first_prompt, cwd FROM session WHERE argo_id = ?',
          )
          .get(sessionId),
      ),
      {
        argo_id: sessionId,
        project_id: 'project-1',
        worktree_path: null,
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
    await assert.rejects(start(supervisor, first), harnessStartFailed)
    // The same draft revision sends again, because the refused start never reached the Harness.
    await start(supervisor, { ...first, commandId: 'retry-command' })
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
    // The Harness named its Session first, so whether the Turn ran is unknown.
    await assert.rejects(start(supervisor, first), (error: Error) => {
      assert.ok(!(error instanceof SessionSubmitRejectedError))
      return /Failed query/.test(error.message)
    })
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
