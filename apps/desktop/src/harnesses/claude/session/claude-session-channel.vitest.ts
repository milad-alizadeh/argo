import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { expect, test, vi } from 'vitest'
import type { SessionStartInput } from '@/domains/sessions/main/api'
import type { LiveSessionControls } from '@/harnesses/registration'
import { liveSessionChannelEventSchema } from '@/harnesses/registration'
import { claudeSessionChannelOpener } from './claude-session-channel'

const vendor = vi.hoisted(() => ({
  prompts: [] as unknown[],
  interrupts: 0,
  releaseSecond: null as (() => void) | null,
  canUseTool: null as CanUseTool | null,
  recordedEvents: [] as unknown[],
  commands: [] as unknown[],
  executable: undefined as string | undefined,
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({
    prompt,
    options,
  }: {
    prompt: AsyncGenerator<unknown>
    options: { canUseTool?: CanUseTool; pathToClaudeCodeExecutable?: string }
  }) => {
    vendor.canUseTool = options.canUseTool ?? null
    vendor.executable = options.pathToClaudeCodeExecutable
    let closed = false
    let count = 0
    const pending: unknown[] = []
    return {
      async next() {
        if (closed) return { done: true as const, value: undefined }
        if (pending.length > 0) return { done: false as const, value: pending.shift() }
        const item = await prompt.next()
        if (item.done) return { done: true as const, value: undefined }
        vendor.prompts.push(item.value)
        count += 1
        if (count === 2)
          await new Promise<void>((resolve) => {
            vendor.releaseSecond = resolve
          })
        if (count === 1) pending.push(...vendor.recordedEvents)
        pending.push({ type: 'result', session_id: 'native-1', is_error: false })
        return { done: false as const, value: pending.shift() }
      },
      [Symbol.asyncIterator]() {
        return this
      },
      async interrupt() {
        vendor.interrupts += 1
      },
      async supportedCommands() {
        return vendor.commands
      },
      close() {
        closed = true
      },
    }
  },
}))

const first: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'claude',
  projectId: '00000000-0000-4000-8000-000000000099',
  workspaceId: '00000000-0000-4000-8000-000000000098',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'sonnet', effort: 'medium', mode: 'manual' },
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  throw new Error('Claude channel did not produce the expected event.')
}

function interactiveControls(): LiveSessionControls {
  let decidePermission!: (decision: 'allow') => void
  let decideQuestion!: (answers: [{ kind: 'options'; indices: number[] }]) => void
  return {
    requestPermission: async () =>
      new Promise((resolve) => {
        decidePermission = () => resolve('allow')
      }),
    requestQuestion: async () =>
      new Promise((resolve) => {
        decideQuestion = resolve
      }),
    decidePermission: (_nativeId, requestId, decision) => {
      if (requestId !== 'permission-1' || decision !== 'allow') return false
      decidePermission('allow')
      return true
    },
    decideQuestion: (_nativeId, requestId, answers) => {
      if (requestId !== 'question-1') return false
      decideQuestion(answers as [{ kind: 'options'; indices: number[] }])
      return true
    },
  }
}

// Runs the first Turn over `vendor.recordedEvents` and returns its Feed content and parsed events.
async function completedTurn() {
  const events: unknown[] = []
  const channel = claudeSessionChannelOpener(null)(first, undefined, (event) => events.push(event))
  await until(() => events.some((event) => (event as { type: string }).type === 'turn.completed'))
  const parsed = events.map((event) => liveSessionChannelEventSchema.parse(event))
  const content = parsed.flatMap((event) =>
    event.type === 'feed' && event.body.type === 'content' ? [event.body.content] : [],
  )
  return { channel, parsed, content }
}

// Closes the channel and returns the warnings it reported.
async function closingWarnings(channel: { close(): void }) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    channel.close()
    await until(() => warn.mock.calls.length > 0)
    return warn.mock.calls
  } finally {
    warn.mockRestore()
  }
}

test('validates delayed identity and completes each submitted Turn once', async () => {
  vendor.prompts = []
  vendor.recordedEvents = readFileSync(
    new URL('../../../../mocks/cli/claude/fixtures/claude-live-stream.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  vendor.interrupts = 0
  vendor.releaseSecond = null
  const events: unknown[] = []
  const channel = claudeSessionChannelOpener(null)(first, undefined, (event) => events.push(event))
  await until(() => events.some((event) => (event as { type: string }).type === 'turn.completed'))
  expect(events.map((event) => liveSessionChannelEventSchema.parse(event).type)).toContain(
    'identity',
  )
  expect(events).toContainEqual({ type: 'identity', nativeId: 'native-1' })
  expect(
    events.some((event) => {
      const parsed = liveSessionChannelEventSchema.parse(event)
      return parsed.type === 'feed' && parsed.body.type === 'content'
    }),
  ).toBe(true)
  const second = { ...first, commandId: '00000000-0000-4000-8000-000000000002', prompt: 'second' }
  await channel.submit(second)
  await channel.submit(second)
  await until(() => vendor.releaseSecond !== null)
  await channel.interrupt()
  expect(vendor.interrupts).toBe(1)
  const releaseSecond = vendor.releaseSecond as (() => void) | null
  if (releaseSecond === null) throw new Error('Second Claude Turn was not held.')
  releaseSecond()
  await until(
    () =>
      events.filter(
        (event) =>
          (event as { type: string; commandId?: string }).type === 'turn.completed' &&
          (event as { commandId?: string }).commandId === second.commandId,
      ).length === 1,
  )
  expect(vendor.prompts).toHaveLength(2)
  expect(
    events.filter((event) => (event as { type: string }).type === 'command.accepted'),
  ).toHaveLength(2)
  channel.close()
  expect(events).toContainEqual({ type: 'closed' })
})

test('runs the Claude executable the registration resolved', () => {
  claudeSessionChannelOpener('/bin/mock-claude')(first, undefined, () => {}).close()
  expect(vendor.executable).toBe('/bin/mock-claude')
  claudeSessionChannelOpener(null)(first, undefined, () => {}).close()
  expect(vendor.executable).toBeUndefined()
})

test('answers Claude Permission and Question requests through the channel', async () => {
  vendor.prompts = []
  vendor.recordedEvents = []
  vendor.canUseTool = null
  const events: unknown[] = []
  const channel = claudeSessionChannelOpener(null)(first, interactiveControls(), (event) =>
    events.push(event),
  )
  await until(() => events.some((event) => (event as { type: string }).type === 'turn.completed'))
  const canUseTool = vendor.canUseTool as CanUseTool | null
  if (canUseTool === null) throw new Error('Claude did not receive the control callback.')
  const options = {
    requestId: 'permission-1',
    toolUseID: 'tool-1',
    title: 'Run command',
    displayName: 'Bash',
    signal: new AbortController().signal,
    suggestions: [],
  } as Parameters<CanUseTool>[2]
  const permission = canUseTool('Bash', {}, options)
  await until(() =>
    events.some(
      (event) => (event as { type: string; body?: { type: string } }).body?.type === 'permission',
    ),
  )
  expect(await channel.answerPermission('permission-1', 'allow')).toBe(true)
  expect(await permission).toMatchObject({ behavior: 'allow' })

  const question = canUseTool(
    'AskUserQuestion',
    {
      questions: [
        {
          question: 'Which option?',
          header: null,
          multiSelect: false,
          options: [{ label: 'First', description: null }],
        },
      ],
    },
    { ...options, requestId: 'question-1', toolUseID: 'tool-2' },
  )
  await until(() =>
    events.some(
      (event) => (event as { type: string; body?: { type: string } }).body?.type === 'question',
    ),
  )
  expect(await channel.answerQuestion('question-1', [{ kind: 'options', indices: [1] }])).toBe(true)
  expect(await question).toMatchObject({
    behavior: 'allow',
    updatedInput: { answers: { 'Which option?': 'First' } },
  })
  channel.close()
})

import { readFileSync } from 'node:fs'

test('streams an Agent call as a start and a response its notification completes', async () => {
  vendor.prompts = []
  vendor.releaseSecond = null
  const envelope = { session_id: 'native-1' }
  vendor.recordedEvents = [
    {
      ...envelope,
      type: 'assistant',
      uuid: 'live-a-1',
      parent_tool_use_id: null,
      message: {
        id: 'msg_live_1',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_live_agent',
            name: 'Agent',
            input: { description: 'Survey adapters', prompt: 'Survey the adapters.' },
          },
        ],
      },
    },
    {
      ...envelope,
      type: 'system',
      subtype: 'task_started',
      uuid: 'live-s-1',
      task_id: 'a1b2c3d4e5f6a7b8c',
      tool_use_id: 'toolu_live_agent',
      description: 'Survey adapters',
    },
    {
      ...envelope,
      type: 'system',
      subtype: 'task_notification',
      uuid: 'live-s-2',
      task_id: 'a1b2c3d4e5f6a7b8c',
      tool_use_id: 'toolu_live_agent',
      status: 'completed',
      output_file: '/tmp/a1b2c3d4e5f6a7b8c.output',
      summary: 'Agent "Survey adapters" finished',
    },
  ]
  const { channel, content } = await completedTurn()
  expect(content.filter((entry) => entry.kind === 'tool' || entry.kind === 'task')).toEqual([])
  expect(
    content.flatMap((entry) =>
      entry.kind === 'delegation' ? [[entry.id, entry.agentId, entry.status]] : [],
    ),
  ).toEqual([
    ['toolu_live_agent', 'a1b2c3d4e5f6a7b8c', 'running'],
    ['toolu_live_agent:response', 'a1b2c3d4e5f6a7b8c', 'completed'],
  ])
  channel.close()
})

test('replaces the command list when Claude reports commands_changed', async () => {
  vendor.prompts = []
  vendor.commands = [
    { name: 'implement', description: 'Build an approved ticket', argumentHint: '<ticket>' },
  ]
  vendor.recordedEvents = [
    {
      type: 'system',
      subtype: 'commands_changed',
      commands: [
        { name: 'review', description: 'Read the diff', argumentHint: '' },
        { name: 'bad name', description: 'nope' },
      ],
    },
  ]
  try {
    const { channel, parsed } = await completedTurn()
    const listed = parsed.flatMap((event) => (event.type === 'commands' ? [event] : []))
    expect(listed[0]?.commands.map((command) => command.name)).toEqual(['implement'])
    expect(listed.at(-1)?.commands).toEqual([
      { name: 'review', description: 'Read the diff', argumentHint: '', aliases: [] },
    ])
    expect(await closingWarnings(channel)).toContainEqual([
      'Rejected 1 unsupported Claude live shape(s).',
    ])
  } finally {
    vendor.commands = []
  }
})

test('streams system task updates, notices, and markers, and counts an unknown subtype', async () => {
  vendor.prompts = []
  vendor.releaseSecond = null
  const envelope = { type: 'system', session_id: 'native-1' }
  vendor.recordedEvents = [
    {
      ...envelope,
      subtype: 'task_started',
      uuid: 'task-1',
      task_id: 'shell-1',
      tool_use_id: 'call-1',
      description: 'Build',
    },
    {
      ...envelope,
      subtype: 'task_progress',
      uuid: 'task-2',
      task_id: 'shell-1',
      tool_use_id: 'call-1',
      description: 'Build',
      summary: 'Compiling',
    },
    { ...envelope, subtype: 'notification', uuid: 'notice-1', key: 'b', text: 'Build finished' },
    {
      ...envelope,
      subtype: 'compact_boundary',
      uuid: 'compact-1',
      compact_metadata: { trigger: 'auto', pre_tokens: 100 },
    },
    { ...envelope, subtype: 'future_subtype', uuid: 'future-1' },
  ]
  const { channel, content } = await completedTurn()
  const task = { id: 'shell-1', kind: 'task', taskId: 'shell-1', callId: 'call-1' }
  expect(content.filter((entry) => entry.kind !== 'message')).toEqual([
    { ...task, status: 'running', description: 'Build', summary: null },
    { ...task, status: 'running', description: 'Build', summary: 'Compiling' },
    { id: 'notice-1', kind: 'notification', text: 'Build finished' },
    { id: 'compact-1', kind: 'marker', marker: 'compaction', summary: null },
    {
      id: 'future-1',
      kind: 'diagnostic',
      vendorType: 'system:future_subtype',
      detail: 'Unsupported Claude output.',
    },
  ])
  expect(await closingWarnings(channel)).toContainEqual([
    'Rejected 1 unsupported Claude live shape(s).',
  ])
})
