import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, fromCallback, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { claudeSessionMachine } from '@/harnesses/claude/session/claude-session-machine'
import type { SessionStartInput } from '../../contract/session-start'
import { sessionMachine } from './session-machine'

const first: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'claude',
  projectId: '00000000-0000-4000-8000-000000000099',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  setup: { model: 'model', effort: 'medium', mode: 'default' },
}

function testMachine(services: {
  start?: () => Promise<string>
  send?: (prompt: string) => Promise<void>
  persist?: () => Promise<string>
}) {
  let promptCount = 0
  const harness = claudeSessionMachine.provide({
    actors: {
      queryActor: fromCallback(({ receive, sendBack }) => {
        receive((event) => {
          promptCount += 1
          if (promptCount === 1)
            void (services.start?.() ?? Promise.resolve('native-1')).then(
              (nativeId) => sendBack({ type: 'Opened', nativeId }),
              (error) => sendBack({ type: 'Query failed', detail: String(error) }),
            )
          else
            void (services.send?.(event.prompt) ?? Promise.resolve()).then(
              () => sendBack({ type: 'Sent' }),
              (error) => sendBack({ type: 'Query failed', detail: String(error) }),
            )
        })
      }),
    },
  })
  return sessionMachine.provide({
    actors: {
      harness,
      persist: fromPromise(() => services.persist?.() ?? Promise.resolve('argo-1')),
    },
  })
}

test('models Session lifecycle and failure paths', () => {
  const paths = getShortestPaths(testMachine({}), {
    input: first,
    events: (snapshot) => {
      if (snapshot.matches('Starting'))
        return [
          { type: 'Harness ready' as const, nativeId: 'native-1' },
          { type: 'Harness failed' as const, failure: 'opening failed' },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Persisting'))
        return [
          { type: 'xstate.done.actor.persist' as const, output: 'argo-1' },
          { type: 'xstate.error.actor.persist' as const, error: 'persistence failed' },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Ready'))
        return [
          { type: 'Send' as const, command: { ...first, commandId: 'second' } },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Sending'))
        return [
          { type: 'Harness ready' as const, nativeId: 'native-1' },
          { type: 'Harness failed' as const, failure: 'send failed' },
          { type: 'Close' as const },
        ]
      return snapshot.matches('Failed') ? [{ type: 'Close' as const }] : []
    },
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => String(state.value))),
    new Set(['Starting', 'Persisting', 'Ready', 'Sending', 'Failed', 'Closed']),
  )
})

test('models queued commands draining in FIFO order', () => {
  const second = { ...first, commandId: 'second', prompt: 'second' }
  const third = { ...first, commandId: 'third', prompt: 'third' }
  const machine = testMachine({})
  const serializeState = (state: ReturnType<typeof machine.getInitialSnapshot>) =>
    JSON.stringify({
      state: state.value,
      queue: state.context.queue.map(({ commandId }) => commandId),
    })
  const queuedPaths = getShortestPaths(machine, {
    input: first,
    serializeState,
    toState: (state) => state.matches('Sending') && state.context.queue.length === 2,
    events: (state) => {
      if (state.matches('Starting'))
        return [
          { type: 'Send' as const, command: second },
          { type: 'Send' as const, command: third },
          { type: 'Harness ready' as const, nativeId: 'native-1' },
        ]
      return state.matches('Persisting')
        ? [{ type: 'xstate.done.actor.persist' as const, output: 'argo-1' }]
        : []
    },
  })
  const queued = queuedPaths.find(
    ({ state }) => state.matches('Sending') && state.context.queue.length === 2,
  )?.state
  assert.ok(queued)
  assert.deepEqual(
    queued.context.queue.map(({ prompt }) => prompt),
    ['second', 'third'],
  )
  const drainedPaths = getShortestPaths(machine, {
    input: first,
    fromState: queued,
    serializeState,
    toState: (state) => state.matches('Ready'),
    events: (state) =>
      state.matches('Sending') ? [{ type: 'Harness ready' as const, nativeId: 'native-1' }] : [],
  })
  const drained = drainedPaths.find(({ state }) => state.matches('Ready'))
  assert.ok(drained)
  assert.deepEqual(
    drained.steps
      .filter(({ event }) => event.type === 'Harness ready')
      .map(({ state }) => state.context.queue.map(({ prompt }) => prompt)),
    [['third'], []],
  )
})

test('queues later sends until persistence, then delivers them in order', async () => {
  let releaseStart!: (nativeId: string) => void
  let releasePersist!: (argoId: string) => void
  const delivered: string[] = []
  const actor = createActor(
    testMachine({
      start: () =>
        new Promise((resolve) => {
          releaseStart = resolve
        }),
      persist: () =>
        new Promise((resolve) => {
          releasePersist = resolve
        }),
      send: async (prompt) => {
        delivered.push(prompt)
      },
    }),
    { input: first },
  ).start()
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  actor.send({ type: 'Send', command: { ...first, commandId: 'third', prompt: 'third' } })
  releaseStart('native-1')
  await waitFor(actor, (snapshot) => snapshot.matches('Persisting'))
  releasePersist('argo-1')
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, ['second', 'third'])
  actor.stop()
})

test('does not deliver a duplicate first command', async () => {
  const delivered: string[] = []
  const actor = createActor(
    testMachine({
      send: async (prompt) => {
        delivered.push(prompt)
      },
    }),
    { input: first },
  ).start()
  actor.send({ type: 'Send', command: first })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, [])
  actor.stop()
})

test('fails when the Harness send fails', async () => {
  const actor = createActor(
    testMachine({
      send: async () => {
        throw new Error('delivery failed')
      },
    }),
    { input: first },
  ).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  const failed = await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
  assert.match(failed.context.failure ?? '', /delivery failed/)
  actor.stop()
})

test('leaves queued turns unsent when persistence fails', async () => {
  const delivered: string[] = []
  const actor = createActor(
    testMachine({
      persist: async () => {
        throw new Error('disk failed')
      },
      send: async (prompt) => {
        delivered.push(prompt)
      },
    }),
    { input: first },
  ).start()
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  const failed = await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
  assert.match(failed.context.failure ?? '', /disk failed/)
  assert.deepEqual(delivered, [])
  actor.stop()
})
