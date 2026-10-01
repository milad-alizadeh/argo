import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import recorded from '../../../../mocks/cli/codex/fixtures/live-notifications-codex-0.157.0.json' with {
  type: 'json',
}
import { mockCodexChannel, mockStartInput } from '../../../../mocks/cli/codex/mock-codex-channel'
import type { CodexRequest, WireMessage } from '../app-server/codex-app-server-client'
import type { openCodexSessionChannel } from './codex-session-channel'

function sampleMessages(notify: (message: WireMessage) => unknown) {
  notify({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'prompt-1',
        type: 'userMessage',
        content: [
          { type: 'text', text: 'first' },
          { type: 'localImage', path: '/repo/image.png' },
          { type: 'skill', name: 'review', path: '/repo/.agents/skills/review/SKILL.md' },
          { type: 'audio', url: 'data:audio/wav;base64,AA==' },
        ],
      },
    },
  })
  notify({
    method: 'item/agentMessage/delta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reply-1',
      delta: 'Hel',
    },
  })
  notify({
    method: 'item/agentMessage/delta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reply-1',
      delta: 'lo',
    },
  })
  notify({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: { id: 'reply-1', type: 'agentMessage', text: 'Hello' },
    },
  })
}

function sampleCommand(notify: (message: WireMessage) => unknown) {
  notify({
    method: 'item/started',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: { id: 'command-1', type: 'commandExecution', command: 'ls', status: 'inProgress' },
    },
  })
  notify({
    method: 'item/commandExecution/outputDelta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'command-1',
      delta: 'README',
    },
  })
  notify({
    method: 'item/completed',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'command-1',
        type: 'commandExecution',
        command: 'ls',
        status: 'completed',
        aggregatedOutput: 'README.md',
        exitCode: 0,
      },
    },
  })
}

function assertSampleFeed(events: LiveSessionChannelEvent[]) {
  const content = events.flatMap((event) =>
    event.type === 'feed' && event.body.type === 'content' ? [event.body.content] : [],
  )
  assert.deepEqual(
    content.flatMap((item) =>
      item.kind === 'message' && item.id === 'reply-1' ? [item.text] : [],
    ),
    ['Hel', 'Hello', 'Hello'],
  )
  assert.ok(
    content.some(
      (item) =>
        item.kind === 'message' &&
        item.id === 'prompt-1' &&
        item.text === 'first' &&
        item.images?.length === 1,
    ),
  )
  assert.deepEqual(
    content.flatMap((item) =>
      item.kind === 'reference' && item.referenceType === 'skill'
        ? [[item.label, item.target]]
        : [],
    ),
    [['review', '/repo/.agents/skills/review/SKILL.md']],
  )
  assert.deepEqual(
    content.flatMap((item) =>
      item.kind === 'command' ? [[item.id, item.status, item.output]] : [],
    ),
    [
      ['command-1', 'running', null],
      ['command-1', 'running', 'README'],
      ['command-1', 'completed', 'README.md'],
    ],
  )
}

async function answerSampleApproval(context: {
  channel: ReturnType<typeof openCodexSessionChannel>
  notify: (message: WireMessage) => unknown
  responses: Array<{ id: string | number; result: unknown }>
  events: LiveSessionChannelEvent[]
}) {
  const { channel, notify, responses, events } = context
  assert.equal(
    notify({
      id: 7,
      method: 'item/commandExecution/requestApproval',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'command-1',
        command: 'touch approved.txt',
        cwd: '/repo',
        availableDecisions: ['accept', 'cancel'],
      },
    }),
    true,
  )
  assert.equal(await channel.answerPermission('command-1', 'allow'), true)
  assert.deepEqual(responses, [{ id: 7, result: { decision: 'accept' } }])
  assert.deepEqual(
    events.flatMap((event) =>
      event.type === 'feed' && event.body.type === 'permission' ? [event.body.decision] : [],
    ),
    [null, 'allow'],
  )
}

async function answerSampleQuestion(
  channel: ReturnType<typeof openCodexSessionChannel>,
  notify: (message: WireMessage) => unknown,
  responses: Array<{ id: string | number; result: unknown }>,
) {
  assert.equal(
    notify({
      id: 8,
      method: 'item/tool/requestUserInput',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'question-1',
        questions: [
          {
            id: 'color',
            header: 'Color',
            question: 'Which color?',
            isSecret: false,
            options: [{ label: 'Blue', description: 'Choose blue.' }],
          },
        ],
      },
    }),
    true,
  )
  assert.equal(
    await channel.answerQuestion('question-1', [{ kind: 'options', indices: [2] }]),
    false,
  )
  assert.equal(
    await channel.answerQuestion('question-1', [{ kind: 'options', indices: [1] }]),
    true,
  )
  assert.deepEqual(responses[1], { id: 8, result: { answers: { color: { answers: ['Blue'] } } } })
}

test('Codex channel opens once, queues sends, and updates stable Feed items', async () => {
  const calls: string[] = []
  let turn = 0
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    calls.push(method)
    if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
    if (method === 'turn/start') return parse({ turn: { id: `turn-${++turn}` } })
    throw new Error(`Unexpected request: ${method}`)
  }) as CodexRequest
  const { channel, events, notify, subscribed } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['thread/start', 'turn/start'])
  assert.deepEqual(events.slice(0, 2), [
    { type: 'identity', nativeId: 'thread-1' },
    { type: 'command.accepted', commandId: mockStartInput.commandId },
  ])
  await channel.submit({ ...mockStartInput, commandId: 'second-command', prompt: 'second' })
  assert.equal(calls.length, 2)
  sampleMessages(notify)
  sampleCommand(notify)
  notify({
    method: 'turn/completed',
    params: {
      threadId: 'thread-1',
      turn: { id: 'turn-1', status: 'completed' },
    },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['thread/start', 'turn/start', 'turn/start'])
  assertSampleFeed(events)
  channel.close()
  assert.equal(subscribed(), false)
})

test('Codex controls answer vendor requests and interrupt the active Turn', async () => {
  const responses: Array<{ id: string | number; result: unknown }> = []
  const calls: Array<{ method: string; params: unknown }> = []
  const request = (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
    if (method === 'turn/start') return parse({ turn: { id: 'turn-1' } })
    if (method === 'turn/interrupt') return parse({})
    throw new Error(`Unexpected request: ${method}`)
  }) as CodexRequest
  const { channel, events, notify } = mockCodexChannel(request, responses)
  await new Promise((resolve) => setImmediate(resolve))
  await answerSampleApproval({ channel, notify, responses, events })
  await answerSampleQuestion(channel, notify, responses)
  assert.deepEqual(
    events.flatMap((event) =>
      event.type === 'feed' && event.body.type === 'status' ? [event.body.status] : [],
    ),
    ['running', 'permission', 'running', 'asking', 'running'],
  )
  await channel.interrupt()
  assert.deepEqual(calls.at(-1), {
    method: 'turn/interrupt',
    params: { threadId: 'thread-1', turnId: 'turn-1' },
  })
  channel.close()
})

test('Codex channel projects recorded app-server notifications', async () => {
  const threadId = recorded.messages[0]?.params.threadId
  const started = recorded.messages.find((message) => message.method === 'turn/started')
  const turnId = started?.params.turn?.id
  assert.ok(threadId)
  assert.ok(turnId)
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    switch (method) {
      case 'thread/start':
        return parse({ thread: { id: threadId } })
      case 'turn/start':
        return parse({ turn: { id: turnId } })
      default:
        throw new Error(`Unexpected request: ${method}`)
    }
  }) as CodexRequest
  const { channel, events, notify, subscribed } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(subscribed(), true)
  for (const message of recorded.messages) notify(message as WireMessage)
  const messages = events.flatMap((event) =>
    event.type === 'feed' && event.body.type === 'content' && event.body.content.kind === 'message'
      ? [event.body.content]
      : [],
  )
  assert.deepEqual(
    messages.map(({ role, text }) => [role, text]),
    [
      ['user', 'Reply OK.'],
      ['assistant', 'OK'],
    ],
  )
  assert.equal(events.filter((event) => event.type === 'turn.started').length, 1)
  channel.close()
})

function sendProgressNotifications(notify: (message: WireMessage) => void) {
  const item = (id: string, type: string, fields: Record<string, unknown>) => ({
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: { id, type, ...fields },
  })
  notify({
    method: 'item/started',
    params: item('progress-1', 'agentMessage', { phase: 'commentary' }),
  })
  notify({
    method: 'item/agentMessage/delta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'progress-1',
      delta: 'Reading files',
    },
  })
  notify({
    method: 'item/reasoning/summaryTextDelta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reason-1',
      summaryIndex: 0,
      delta: 'Checking',
    },
  })
  notify({
    method: 'item/reasoning/summaryTextDelta',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reason-1',
      summaryIndex: 0,
      delta: ' the results',
    },
  })
  notify({
    method: 'item/completed',
    params: item('reason-1', 'reasoning', {
      summary: ['Checking the results'],
    }),
  })
  notify({
    method: 'item/completed',
    params: item('answer-1', 'agentMessage', {
      text: 'Done',
      phase: 'final_answer',
    }),
  })
}

const startedThreadRequest = (async (
  method: string,
  _params: unknown,
  parse: (value: unknown) => unknown,
) => {
  if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
  if (method === 'turn/start') return parse({ turn: { id: 'turn-1' } })
  if (method === 'thread/read') return parse({ thread: { agentNickname: null, turns: [] } })
  throw new Error(`Unexpected request: ${method}`)
}) as CodexRequest

test('Codex live commentary and reasoning stay separate from the final answer', async () => {
  const request = startedThreadRequest
  const { channel, events, notify } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  sendProgressNotifications(notify)
  const content = events.flatMap((event) =>
    event.type === 'feed' && event.body.type === 'content' ? [event.body.content] : [],
  )
  assert.deepEqual(content, [
    {
      kind: 'message',
      id: 'progress-1',
      role: 'assistant',
      text: 'Reading files',
      phase: 'commentary',
    },
    { kind: 'reasoning', id: 'reason-1', text: 'Checking' },
    { kind: 'reasoning', id: 'reason-1', text: 'Checking the results' },
    { kind: 'reasoning', id: 'reason-1', text: 'Checking the results' },
    { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Done', phase: 'final_answer' },
  ])
  channel.close()
})

test('a Turn notification establishes vendor delivery before the request response', async () => {
  let rejectTurn: ((error: Error) => void) | undefined
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
    if (method === 'turn/start')
      return new Promise((_resolve, reject) => {
        rejectTurn = reject
      })
    throw new Error(`Unexpected request: ${method}`)
  }) as CodexRequest
  const { channel, events, notify, subscribed } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(subscribed(), true)
  notify({
    method: 'turn/started',
    params: {
      threadId: 'thread-1',
      turn: { id: 'turn-1', status: 'inProgress' },
    },
  })
  rejectTurn?.(new Error('request timed out'))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(events.filter((event) => event.type === 'turn.started').length, 1)
  assert.equal(events.filter((event) => event.type === 'failure').length, 0)
  channel.close()
})

test('unknown Codex item shapes are reported and counted', async () => {
  const warnings: string[] = []
  const originalWarn = console.warn
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )) as CodexRequest
  const { channel, notify, subscribed } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(subscribed(), true)
  try {
    console.warn = (message) => warnings.push(String(message))
    notify({
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: { id: 'future-1', type: 'futureItem' },
      },
    })
    notify({
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: { id: 'message-1', type: 'agentMessage' },
      },
    })
    notify({
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: { id: 'image-1', type: 'imageGeneration', status: 'futureStatus' },
      },
    })
  } finally {
    console.warn = originalWarn
    channel.close()
  }
  assert.deepEqual(warnings, [
    'Rejected 1 unsupported Codex live notification(s): item/completed: futureItem',
    'Rejected 2 unsupported Codex live notification(s): item/completed',
    'Rejected 3 unsupported Codex live notification(s): item/completed: imageGeneration:futureStatus',
  ])
})

test('Codex thread status reaches the Session status without repeats (ADR-0024)', async () => {
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )) as CodexRequest
  const { channel, events, notify } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  const thread = (status: Record<string, unknown>, threadId = 'thread-1') =>
    notify({ method: 'thread/status/changed', params: { threadId, status } })
  thread({ type: 'active', activeFlags: [] })
  thread({ type: 'active', activeFlags: ['waitingOnApproval'] })
  thread({ type: 'active', activeFlags: ['waitingOnUserInput'] })
  thread({ type: 'active', activeFlags: [] })
  thread({ type: 'idle' }, 'other-thread')
  thread({ type: 'idle' })
  thread({ type: 'notLoaded' })
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'failed' } },
  })
  thread({ type: 'systemError' })
  assert.deepEqual(
    events.flatMap((event) =>
      event.type === 'feed' && event.body.type === 'status' ? [event.body.status] : [],
    ),
    ['running', 'permission', 'asking', 'running', 'idle', 'stopped', 'unknown'],
  )
  channel.close()
})
