import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { SessionStartInput } from '../../contract/session-start'
import { type QueuedSessionCommand, sessionMachine } from './session-machine'

const first = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'claude' as const,
  projectId: '00000000-0000-4000-8000-000000000099',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  setup: { model: 'model', effort: 'medium', mode: 'default' },
}

function sessionForTest(services: {
  start: (input: SessionStartInput) => Promise<{ nativeId: string }>
  persist: (input: {
    harness: string
    projectId: string
    nativeId: string | null
    firstPrompt: string
  }) => Promise<string>
  drain: (input: { nativeId: string | null; command: QueuedSessionCommand | null }) => Promise<void>
}) {
  return sessionMachine.provide({
    actors: {
      start: fromPromise(({ input }: { input: SessionStartInput }) => services.start(input)),
      persist: fromPromise(
        ({
          input,
        }: {
          input: {
            harness: string
            projectId: string
            nativeId: string | null
            firstPrompt: string
          }
        }) => services.persist(input),
      ),
      drain: fromPromise(
        ({ input }: { input: { nativeId: string | null; command: QueuedSessionCommand | null } }) =>
          services.drain(input),
      ),
    },
  })
}

const modeledMachine = sessionForTest({
  start: async () => ({ nativeId: 'native-1' }),
  persist: async () => '00000000-0000-4000-8000-000000000010',
  drain: async () => {},
})

function stateName(snapshot: ReturnType<typeof modeledMachine.getInitialSnapshot>) {
  if (snapshot.matches('Starting')) return 'Starting'
  if (snapshot.matches('Persisting')) return 'Persisting'
  if (snapshot.matches('Draining')) return 'Draining'
  if (snapshot.matches('Ready')) return 'Ready'
  if (snapshot.matches('Failed')) return 'Failed'
  return 'Closed'
}

test('models the Session lifecycle states', () => {
  const paths = getShortestPaths(modeledMachine, {
    input: first,
    events: (snapshot) => {
      if (snapshot.matches('Starting'))
        return [
          { type: 'xstate.done.actor.start' as const, output: { nativeId: 'native-1' } },
          { type: 'xstate.error.actor.start' as const, error: new Error('start failed') },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Persisting'))
        return [
          {
            type: 'xstate.done.actor.persist' as const,
            output: '00000000-0000-4000-8000-000000000010',
          },
          { type: 'xstate.error.actor.persist' as const, error: new Error('persist failed') },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Draining'))
        return [
          { type: 'xstate.done.actor.drain' as const, output: undefined },
          { type: 'xstate.error.actor.drain' as const, error: new Error('drain failed') },
          { type: 'Close' as const },
        ]
      return snapshot.matches('Ready') || snapshot.matches('Failed')
        ? [{ type: 'Close' as const }]
        : []
    },
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => stateName(state))),
    new Set(['Starting', 'Persisting', 'Draining', 'Ready', 'Failed', 'Closed']),
  )
})

test('queues later sends until persistence then drains them in order', async () => {
  let acceptStart!: (value: { nativeId: string }) => void
  let acceptPersist!: (value: string) => void
  let persistStarted!: () => void
  const persisting = new Promise<void>((resolve) => (persistStarted = resolve))
  const delivered: string[] = []
  const actor = createActor(
    sessionForTest({
      start: () =>
        new Promise((resolve) => {
          acceptStart = resolve
        }),
      persist: () =>
        new Promise((resolve) => {
          acceptPersist = resolve
          persistStarted()
        }),
      drain: async ({ command }) => {
        if (command === null) return
        const { prompt } = command
        delivered.push(prompt)
      },
    }),
    { input: first },
  ).start()
  actor.send({
    type: 'Send',
    command: { ...first, commandId: '00000000-0000-4000-8000-000000000002', prompt: 'second' },
  })
  actor.send({
    type: 'Send',
    command: { ...first, commandId: '00000000-0000-4000-8000-000000000003', prompt: 'third' },
  })
  acceptStart({ nativeId: 'native-1' })
  await waitFor(actor, (snapshot) => snapshot.matches('Persisting'))
  await persisting
  acceptPersist('00000000-0000-4000-8000-000000000010')
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, ['second', 'third'])
  actor.stop()
})

test('does not submit a duplicate first command twice', async () => {
  let starts = 0
  const actor = createActor(
    sessionForTest({
      start: async () => {
        starts += 1
        return { nativeId: 'native-1' }
      },
      persist: async () => '00000000-0000-4000-8000-000000000010',
      drain: async () => {},
    }),
    { input: first },
  ).start()
  actor.send({ type: 'Send', command: first })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.equal(starts, 1)
  actor.stop()
})

test('keeps a command sent while draining behind the active command', async () => {
  let releaseFirstSend!: () => void
  let sendStarted!: () => void
  const sending = new Promise<void>((resolve) => (sendStarted = resolve))
  const delivered: string[] = []
  const actor = createActor(
    sessionForTest({
      start: async () => ({ nativeId: 'native-1' }),
      persist: async () => '00000000-0000-4000-8000-000000000010',
      drain: async ({ command }) => {
        if (command === null) return
        const { prompt } = command
        delivered.push(prompt)
        if (prompt === 'second') {
          sendStarted()
          await new Promise<void>((resolve) => (releaseFirstSend = resolve))
        }
      },
    }),
    { input: first },
  ).start()
  actor.send({
    type: 'Send',
    command: { ...first, commandId: '00000000-0000-4000-8000-000000000002', prompt: 'second' },
  })
  await waitFor(actor, (snapshot) => snapshot.matches('Draining'))
  await sending
  actor.send({
    type: 'Send',
    command: { ...first, commandId: '00000000-0000-4000-8000-000000000003', prompt: 'third' },
  })
  releaseFirstSend()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, ['second', 'third'])
  actor.stop()
})
