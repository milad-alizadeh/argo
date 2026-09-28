import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { expect, test, vi } from 'vitest'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type { LiveSessionControls } from '@/harnesses/registration'
import { liveSessionChannelEventSchema } from '@/harnesses/registration'
import { openClaudeSessionChannel } from './claude-session-channel'

const vendor = vi.hoisted(() => ({
  prompts: [] as unknown[],
  interrupts: 0,
  releaseSecond: null as (() => void) | null,
  canUseTool: null as CanUseTool | null,
  recordedEvents: [] as unknown[],
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({
    prompt,
    options,
  }: {
    prompt: AsyncGenerator<unknown>
    options: { canUseTool?: CanUseTool }
  }) => {
    vendor.canUseTool = options.canUseTool ?? null
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

test('validates delayed identity and completes each submitted Turn once', async () => {
  vendor.prompts = []
  vendor.recordedEvents = readFileSync(
    new URL('./fixtures/claude-live-stream.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  vendor.interrupts = 0
  vendor.releaseSecond = null
  const events: unknown[] = []
  const channel = openClaudeSessionChannel(first, undefined, (event) => events.push(event))
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

test('answers Claude Permission and Question requests through the channel', async () => {
  vendor.prompts = []
  vendor.recordedEvents = []
  vendor.canUseTool = null
  const events: unknown[] = []
  const channel = openClaudeSessionChannel(first, interactiveControls(), (event) =>
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
