import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { mockCodexChannel } from '../../../../mocks/cli/codex/mock-codex-channel'
import type { CodexRequest } from '../app-server/codex-app-server-client'

function subagentNotification(item: Record<string, unknown>) {
  return { method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-1', item } }
}

function delegationFacts(events: readonly LiveSessionChannelEvent[]) {
  return events.flatMap((event) =>
    event.type === 'feed' &&
    event.body.type === 'content' &&
    event.body.content.kind === 'delegation'
      ? [
          [
            event.body.vendorEventId,
            event.body.content.event,
            event.body.content.status,
            event.body.content.prompt,
          ],
        ]
      : [],
  )
}

test('Codex channel streams each Subagent activity as its own delegation event', async () => {
  const { channel, events, notify } = mockCodexChannel(deferredNicknameRequest().request)
  await new Promise((resolve) => setImmediate(resolve))
  notify(
    subagentNotification({
      id: 'call_spawn',
      type: 'collabAgentToolCall',
      tool: 'spawnAgent',
      status: 'completed',
      senderThreadId: 'thread-1',
      receiverThreadIds: ['thread-child'],
      prompt: 'Review the branch',
      model: 'gpt-5',
      reasoningEffort: null,
      agentsStates: {},
    }),
  )
  for (const [id, kind] of [
    ['call_spawn', 'started'],
    ['subagent-completed-1', 'completed'],
  ])
    notify(
      subagentNotification({
        id,
        type: 'subAgentActivity',
        kind,
        agentThreadId: 'thread-child',
        agentPath: '/root/spec_review',
      }),
    )
  assert.deepEqual(delegationFacts(events), [
    ['call_spawn', 'started', 'running', 'Review the branch'],
    ['subagent-completed-1', 'responded', 'completed', null],
  ])
  channel.close()
})

// A channel whose Subagent thread read waits until the test answers it.
function deferredNicknameRequest() {
  let answer: (value: unknown) => void = () => {}
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
    if (method === 'turn/start') return parse({ turn: { id: 'turn-1' } })
    return parse(await new Promise((resolve) => (answer = resolve)))
  }) as CodexRequest
  return { request, answer: (value: unknown) => answer(value) }
}

function nicknames(events: readonly LiveSessionChannelEvent[]) {
  return events.flatMap((event) =>
    event.type === 'feed' &&
    event.body.type === 'content' &&
    event.body.content.kind === 'delegation'
      ? [[event.body.content.agentId, event.body.content.nickname ?? null]]
      : [],
  )
}

const spawnActivity = (agentThreadId: string) =>
  subagentNotification({
    id: `call_${agentThreadId}`,
    type: 'subAgentActivity',
    kind: 'started',
    agentThreadId,
    agentPath: '/root/spec_review',
  })

test('a Subagent activity draws at once and again with its thread nickname', async () => {
  const { request, answer } = deferredNicknameRequest()
  const { channel, events, notify } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  notify(spawnActivity('thread-child'))
  assert.deepEqual(nicknames(events), [['thread-child', null]])
  answer({ thread: { agentNickname: 'Jason' } })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(nicknames(events), [
    ['thread-child', null],
    ['thread-child', 'Jason'],
  ])
  channel.close()
})

test('a Subagent nickname that lands after its Turn ended still redraws the activity', async () => {
  const { request, answer } = deferredNicknameRequest()
  const { channel, events, notify } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  notify(spawnActivity('thread-late'))
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  })
  answer({ thread: { agentNickname: 'Jason' } })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(nicknames(events).at(-1), ['thread-late', 'Jason'])
  channel.close()
})

test('a Subagent thread read of an unknown shape is reported and draws no nickname', async () => {
  const warning = console.warn
  const warnings: unknown[] = []
  console.warn = (message: unknown) => warnings.push(message)
  const { request, answer } = deferredNicknameRequest()
  const { channel, events, notify } = mockCodexChannel(request)
  try {
    await new Promise((resolve) => setImmediate(resolve))
    notify(spawnActivity('thread-odd'))
    answer({ thread: { agentNickname: 7 } })
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    console.warn = warning
    channel.close()
  }
  assert.deepEqual(nicknames(events), [['thread-odd', null]])
  assert.deepEqual(warnings, ['Rejected 1 unsupported Codex Subagent thread shape.'])
})

test('a Subagent activity of an unknown kind becomes a counted diagnostic row', async () => {
  const warning = console.warn
  const warnings: unknown[] = []
  console.warn = (message: unknown) => warnings.push(message)
  const { channel, events, notify } = mockCodexChannel(deferredNicknameRequest().request)
  try {
    await new Promise((resolve) => setImmediate(resolve))
    notify(
      subagentNotification({
        id: 'call_future',
        type: 'subAgentActivity',
        kind: 'futureKind',
        agentThreadId: 'thread-future',
        agentPath: '/root/spec_review',
      }),
    )
  } finally {
    console.warn = warning
    channel.close()
  }
  const content = events.flatMap((event) =>
    event.type === 'feed' && event.body.type === 'content' ? [event.body.content] : [],
  )
  assert.deepEqual(content, [
    {
      id: 'call_future',
      kind: 'diagnostic',
      vendorType: 'subAgentActivity:futureKind',
      detail: 'Unsupported Codex thread item.',
    },
  ])
  assert.deepEqual(warnings, [
    'Rejected 1 unsupported Codex live notification(s): item: subAgentActivity:futureKind',
  ])
})
