import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type {
  CodexRequest,
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import { openCodexSessionChannel } from '@/harnesses/codex/session/codex-session-channel'
import { answeringSkillsList } from '@/mocks/cli/codex/mock-codex-channel'
import type { SessionStartInput } from '../api/session-submit'
import { liveSessionChannelActor } from './live-session-channel-actor'
import { liveSessionMachine } from './live-session-machine'

const first: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'claude',
  projectId: '00000000-0000-4000-8000-000000000099',
  worktree: null,
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'model', effort: 'medium', mode: 'default' },
}

const passiveChannelMethods = {
  interrupt: async () => {},
  answerPermission: async () => false,
  answerQuestion: async () => false,
  close: () => {},
}

function actorDelivering(
  delivered: string[],
  services: Omit<Parameters<typeof testMachine>[0], 'send'> = {},
) {
  return createActor(
    testMachine({
      ...services,
      send: async (prompt) => {
        delivered.push(prompt)
      },
    }),
    { input: first },
  ).start()
}

function testMachine(services: {
  start?: () => Promise<string>
  send?: (prompt: string) => Promise<void>
  persist?: () => Promise<string>
  emitFeed?: boolean
}) {
  let promptCount = 0
  const harness = liveSessionChannelActor((input, _controls, emit) => {
    const deliver = async (command: typeof first) => {
      promptCount += 1
      if (services.emitFeed)
        emit({
          type: 'feed',
          body: {
            type: 'content',
            commandId: command.commandId,
            turnId: command.commandId,
            vendorEventId: 'assistant-1',
            content: { id: 'assistant-1', kind: 'message', role: 'assistant', text: 'Working' },
          },
        })
      try {
        if (promptCount === 1) {
          const nativeId = await (services.start?.() ?? Promise.resolve('native-1'))
          emit({ type: 'identity', nativeId })
        } else await (services.send?.(command.prompt) ?? Promise.resolve())
        emit({ type: 'turn.completed', commandId: command.commandId })
      } catch (error) {
        emit({ type: 'failure', detail: String(error) })
      }
    }
    queueMicrotask(() => void deliver(input as typeof first))
    return {
      submit: async (command) => deliver(command as typeof first),
      ...passiveChannelMethods,
    }
  }, undefined)
  return liveSessionMachine.provide({
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
  const actor = actorDelivering(delivered, {
    start: () =>
      new Promise((resolve) => {
        releaseStart = resolve
      }),
    persist: () =>
      new Promise((resolve) => {
        releasePersist = resolve
      }),
  })
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  actor.send({ type: 'Send', command: { ...first, commandId: 'third', prompt: 'third' } })
  await Promise.resolve()
  releaseStart('native-1')
  await waitFor(actor, (snapshot) => snapshot.matches('Persisting'))
  releasePersist('argo-1')
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, ['second', 'third'])
  actor.stop()
})

test('persists a Claude Session before its first turn finishes and holds queued sends', async () => {
  let finishTurn!: () => void
  const delivered: string[] = []
  const harness = liveSessionChannelActor((input, _controls, emit) => {
    queueMicrotask(() => {
      delivered.push(input.prompt)
      emit({ type: 'identity', nativeId: 'native-1' })
      finishTurn = () => emit({ type: 'turn.completed', commandId: input.commandId })
    })
    return {
      submit: async (command) => {
        delivered.push(command.prompt)
        emit({ type: 'turn.completed', commandId: command.commandId })
      },
      ...passiveChannelMethods,
    }
  }, undefined)
  const actor = createActor(
    liveSessionMachine.provide({
      actors: { harness, persist: fromPromise(async () => 'argo-1') },
    }),
    { input: first },
  ).start()
  const persisted = await waitFor(actor, (snapshot) => snapshot.matches('Awaiting turn'))
  assert.equal(persisted.context.argoId, 'argo-1')
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  assert.deepEqual(delivered, ['first'])
  finishTurn()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, ['first', 'second'])
  actor.stop()
})

test('does not deliver a duplicate first command', async () => {
  const delivered: string[] = []
  const actor = actorDelivering(delivered)
  actor.send({ type: 'Send', command: first })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(delivered, [])
  actor.stop()
})

test('does not deliver a duplicate later command after that Turn completes', async () => {
  const delivered: string[] = []
  const actor = actorDelivering(delivered)
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  const second = { ...first, commandId: 'second', prompt: 'second' }
  actor.send({ type: 'Send', command: second })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready') && delivered.length === 1)
  actor.send({ type: 'Send', command: second })
  await Promise.resolve()
  assert.deepEqual(delivered, ['second'])
  actor.stop()
})

test('emits validated Claude Feed events while the Session identity is persisting', async () => {
  const actor = createActor(testMachine({ emitFeed: true }), { input: first })
  const events: unknown[] = []
  actor.on('feed', ({ body }) => events.push(body))
  actor.start()
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.deepEqual(events, [
    {
      type: 'content',
      commandId: first.commandId,
      turnId: first.commandId,
      vendorEventId: 'assistant-1',
      content: { id: 'assistant-1', kind: 'message', role: 'assistant', text: 'Working' },
    },
  ])
  actor.stop()
})

function codexHarnessFor(request: CodexRequest) {
  let notify: ((message: WireMessage) => boolean | undefined) | undefined
  const harness = liveSessionChannelActor(
    (input, _controls, emit) =>
      openCodexSessionChannel(
        input,
        {
          request: answeringSkillsList(request),
          onNotification: (listener) => {
            notify = listener
            return () => {
              notify = undefined
            }
          },
          respond: () => {},
        },
        { emit },
      ),
    undefined,
  )
  return { harness, notify: (message: WireMessage) => notify?.(message) }
}

test('forwards Codex notifications and holds queued prompts until Turn completion', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start'
        ? { thread: { id: 'thread-1' } }
        : { turn: { id: calls.length === 2 ? 'turn-1' : 'turn-2' } },
    )
  }
  const { harness, notify } = codexHarnessFor(request)
  const actor = createActor(
    liveSessionMachine.provide({
      actors: { harness, persist: fromPromise(async () => 'argo-1') },
    }),
    {
      input: {
        ...first,
        harness: 'codex',
        turnConfiguration: { ...first.turnConfiguration, mode: 'workspace-write' },
      },
    },
  )
  const events: unknown[] = []
  actor.on('feed', ({ body }) => events.push(body))
  actor.start()
  await waitFor(actor, (snapshot) => snapshot.matches('Awaiting turn'))
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  notify({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: { id: 'message-1', type: 'agentMessage', text: 'Done.' },
    },
  })
  assert.equal(events.length, 2)
  assert.deepEqual(calls, ['thread/start', 'turn/start'])
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  })
  await waitFor(actor, (snapshot) => snapshot.matches('Sending') && calls.length === 3)
  assert.equal(events.length, 4)
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-2', status: 'completed' } },
  })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  assert.equal(events.length, 5)
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
  const actor = actorDelivering(delivered, {
    persist: async () => {
      throw new Error('disk failed')
    },
  })
  actor.send({ type: 'Send', command: { ...first, commandId: 'second', prompt: 'second' } })
  const failed = await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
  assert.match(failed.context.failure ?? '', /disk failed/)
  assert.deepEqual(delivered, [])
  actor.stop()
})

test('stores the Harness command list', async () => {
  const harness = liveSessionChannelActor((_input, _controls, emit) => {
    queueMicrotask(() => {
      emit({
        type: 'commands',
        availability: 'listed',
        commands: [
          {
            name: 'implement',
            description: 'Build an approved ticket',
            argumentHint: '',
            aliases: [],
          },
        ],
      })
    })
    return { submit: async () => {}, ...passiveChannelMethods }
  }, undefined)
  const actor = createActor(liveSessionMachine.provide({ actors: { harness } }), {
    input: first,
  }).start()
  const stored = await waitFor(
    actor,
    (snapshot) => snapshot.context.commands?.commands[0]?.name === 'implement',
  )
  assert.equal(stored.context.commands?.availability, 'listed')
  actor.stop()
})
