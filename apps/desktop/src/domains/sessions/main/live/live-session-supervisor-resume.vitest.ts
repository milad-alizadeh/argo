import assert from 'node:assert/strict'
import { test } from 'vitest'
import { waitFor } from 'xstate'
import {
  claudeCatalog,
  claudeFirst,
  commandStatus,
  completeCodexTurn,
  first,
  passiveChannelMethods,
  recordingCodexRequest,
  send,
  start,
  supervisorFor,
} from '@/mocks/sessions/live-session-supervisor.fixture'
import { liveSessionActorFor } from './live-session-supervisor-machine'

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

test('resumes a persisted Codex Session after its live channel fails', async () => {
  const { calls, request } = recordingCodexRequest((starts) => {
    if (starts === 2) throw new Error('Codex app-server closed.')
  })
  const { root, supervisor, client, notify } = await supervisorFor(request)
  try {
    const { sessionId } = await start(supervisor, first)
    const firstActor = liveSessionActorFor(supervisor, sessionId)
    assert.ok(firstActor)
    await waitFor(firstActor, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-2')
    await waitFor(firstActor, (snapshot) => snapshot.matches('Ready'))
    await send(supervisor, { ...first, sessionId, commandId: 'failing-command', prompt: 'fail' })
    await waitFor(firstActor, (snapshot) => snapshot.matches('Failed'))
    await send(supervisor, { ...first, sessionId, commandId: 'retry-command', prompt: 'retry' })
    const resumed = liveSessionActorFor(supervisor, sessionId)
    assert.ok(resumed)
    assert.notEqual(resumed, firstActor)
    await waitFor(resumed, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-5')
    await waitFor(resumed, (snapshot) => snapshot.matches('Ready'))
    assert.equal(commandStatus(client, 'retry-command'), 'completed')
    assert.deepEqual(calls, [
      'thread/start',
      'turn/start',
      'turn/start',
      'thread/resume',
      'turn/start',
    ])
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

test('retiring an idle actor keeps the Session identity and the next send resumes it', async () => {
  const { calls, request } = recordingCodexRequest()
  const { root, supervisor, client, notify } = await supervisorFor(request)
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
