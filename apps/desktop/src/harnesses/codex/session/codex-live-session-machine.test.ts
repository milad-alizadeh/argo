import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import recorded from '../../../../mocks/cli/codex/fixtures/live-notifications-codex-0.157.0.json' with {
  type: 'json',
}
import type { CodexRequest, WireMessage } from '../app-server/codex-app-server-client'
import { codexLiveSessionActors, codexLiveSessionMachine } from './codex-live-session-machine'

function machineFor(request: CodexRequest) {
  return codexLiveSessionMachine.provide({
    actors: codexLiveSessionActors(request, () => () => {}),
  })
}

const notificationSession: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'codex',
  projectId: '00000000-0000-4000-8000-000000000099',
  workspaceId: '00000000-0000-4000-8000-000000000098',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
}

function notifiedSession(request: CodexRequest) {
  let listener: ((message: WireMessage) => void) | undefined
  const actor = createActor(
    codexLiveSessionMachine.provide({
      actors: codexLiveSessionActors(request, (notify) => {
        listener = notify
        return () => {
          listener = undefined
        }
      }),
    }),
    { input: notificationSession },
  )
  return {
    actor,
    notify: (message: WireMessage) => {
      assert.ok(listener)
      listener(message)
    },
    subscribed: () => listener !== undefined,
  }
}

function assertRejectsUnknownContent(
  notify: (message: WireMessage) => void,
  threadId: string,
  turnId: string,
) {
  const warnings: string[] = []
  const warn = console.warn
  try {
    console.warn = (message) => warnings.push(String(message))
    notify({
      method: 'item/completed',
      params: {
        threadId,
        turnId,
        item: { id: 'bad-item', type: 'userMessage', content: [{ type: 'futureBlock' }] },
      },
    })
  } finally {
    console.warn = warn
  }
  assert.deepEqual(warnings, ['Invalid Codex live notification (1): item/completed'])
}

test('models Codex opening, first turn, later turn, failure, and close paths', () => {
  const paths = getShortestPaths(codexLiveSessionMachine, {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      workspaceId: '00000000-0000-4000-8000-000000000098',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
    events: (snapshot) => {
      if (snapshot.matches('Opening'))
        return [
          { type: 'xstate.done.actor.startThread' as const, output: 'thread-1' },
          { type: 'xstate.error.actor.startThread' as const, error: 'failed' },
        ]
      if (snapshot.matches('Starting first prompt'))
        return [
          { type: 'xstate.done.actor.startFirstTurn' as const, output: 'turn-1' },
          { type: 'xstate.error.actor.startFirstTurn' as const, error: 'failed' },
        ]
      if (snapshot.matches('Ready'))
        return [
          {
            type: 'Send' as const,
            command: {
              commandId: '00000000-0000-4000-8000-000000000002',
              prompt: 'second',
              attachments: [],
              turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
            },
          },
          { type: 'Close' as const },
        ]
      if (snapshot.matches('Starting next prompt'))
        return [
          { type: 'xstate.done.actor.startNextTurn' as const, output: 'turn-2' },
          { type: 'xstate.error.actor.startNextTurn' as const, error: 'failed' },
        ]
      if (snapshot.matches('Running turn'))
        return [
          {
            type: 'Turn completed' as const,
            threadId: 'thread-1',
            turnId: snapshot.context.activeTurnId ?? '',
            status: 'completed' as const,
          },
          { type: 'Close' as const },
        ]
      return snapshot.matches('Failed') ? [{ type: 'Close' as const }] : []
    },
  })
  const visited = paths.map(({ state }) => String(state.value))
  for (const state of [
    'Opening',
    'Starting first prompt',
    'Ready',
    'Starting next prompt',
    'Running turn',
    'Failed',
    'Closed',
  ])
    assert.ok(visited.includes(state), `Missing ${state} path`)
})

test('converts text, files, and images at the Codex Session boundary', async () => {
  let sentInput: unknown
  const request: CodexRequest = async (method, params, parse) => {
    if (method === 'turn/start' && 'input' in params) sentInput = params.input
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(machineFor(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      workspaceId: '00000000-0000-4000-8000-000000000098',
      cwd: '/repo',
      prompt: 'Read these.',
      attachments: [
        { path: '/repo/readme.md', kind: 'file' },
        { path: '/repo/image.png', kind: 'image' },
      ],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Running turn'))
  assert.deepEqual(sentInput, [
    { type: 'text', text: 'Read these.', text_elements: [] },
    {
      type: 'text',
      text: '/repo/readme.md',
      text_elements: [{ byteRange: { start: 0, end: 15 }, placeholder: '/repo/readme.md' }],
    },
    { type: 'localImage', path: '/repo/image.png' },
  ])
  actor.stop()
})

test('starts the first Codex turn before becoming ready', async () => {
  const calls: string[] = []
  const request: CodexRequest = async (method, _params, parse) => {
    calls.push(method)
    return parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )
  }
  const actor = createActor(machineFor(request), {
    input: {
      commandId: '00000000-0000-4000-8000-000000000001',
      harness: 'codex',
      projectId: '00000000-0000-4000-8000-000000000099',
      workspaceId: '00000000-0000-4000-8000-000000000098',
      cwd: '/repo',
      prompt: 'first',
      attachments: [],
      turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches('Running turn'))
  assert.deepEqual(calls, ['thread/start', 'turn/start'])
  actor.stop()
})

test('starts later Codex prompts only after the prior Turn completes', async () => {
  const calls: Array<{ method: string; threadId?: string }> = []
  const request: CodexRequest = async (method, params, parse) => {
    calls.push({
      method,
      threadId: method === 'turn/start' && 'threadId' in params ? params.threadId : undefined,
    })
    return parse(
      method === 'thread/start'
        ? { thread: { id: 'thread-1' } }
        : { turn: { id: calls.length === 2 ? 'turn-1' : 'turn-2' } },
    )
  }
  const { actor, notify } = notifiedSession(request)
  actor.start()
  const second = {
    commandId: '00000000-0000-4000-8000-000000000002',
    prompt: 'second',
    attachments: [],
    turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
  }
  await waitFor(actor, (snapshot) => snapshot.matches('Running turn'))
  actor.send({ type: 'Send', command: second })
  assert.equal(calls.length, 2)
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  })
  await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  actor.send({ type: 'Send', command: second })
  await waitFor(actor, (snapshot) => snapshot.matches('Running turn') && calls.length === 3)
  assert.deepEqual(calls, [
    { method: 'thread/start', threadId: undefined },
    { method: 'turn/start', threadId: 'thread-1' },
    { method: 'turn/start', threadId: 'thread-1' },
  ])
  actor.stop()
})

test('projects Codex item and completion notifications into ordered live Feed events', async () => {
  const notifications: WireMessage[] = recorded.messages
  const started = notifications.find(
    (message) => 'method' in message && message.method === 'turn/started',
  )
  assert.ok(started && 'method' in started)
  const threadId = started.params.threadId as string
  const turnId = (started.params.turn as { id: string }).id
  const request: CodexRequest = async (method, _params, parse) =>
    parse(method === 'thread/start' ? { thread: { id: threadId } } : { turn: { id: turnId } })
  const { actor, notify, subscribed } = notifiedSession(request)
  const feeds: Array<SessionLiveEventBody> = []
  let lastSerial = 0
  actor.subscribe((snapshot) => {
    const feed = snapshot.context.lastFeed
    if (feed !== null && feed.serial > lastSerial) {
      feeds.push(feed.body)
      lastSerial = feed.serial
    }
  })
  actor.start()
  await waitFor(actor, (snapshot) => snapshot.matches('Running turn'))
  assertRejectsUnknownContent(notify, threadId, turnId)
  assert.equal(actor.getSnapshot().context.feedSerial, 1)
  for (const message of notifications) notify(message)
  assert.deepEqual(
    feeds.map(({ type }) => type),
    ['status', 'content', 'content', 'status'],
  )
  const itemIds = notifications.flatMap((message) =>
    'method' in message && message.method === 'item/completed'
      ? [(message.params.item as { id: string }).id]
      : [],
  )
  assert.deepEqual(
    feeds.map(({ vendorEventId }) => vendorEventId),
    [null, ...itemIds, null],
  )
  assert.deepEqual(
    feeds.map((feed) =>
      feed.type === 'content' && feed.content.kind === 'message' ? feed.content.text : null,
    ),
    [null, 'Reply OK.', 'OK', null],
  )
  assert.equal(feeds[3]?.type === 'status' && feeds[3].status, 'idle')
  assert.equal(actor.getSnapshot().context.feedSerial, 4)
  actor.stop()
  assert.equal(subscribed(), false)
})
