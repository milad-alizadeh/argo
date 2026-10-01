import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { claudeFeedContent } from './claude-feed'
import { ClaudeFeedProjection } from './claude-feed-projection'

function agentCall(callId: string, prompt: string): FeedContent {
  return {
    kind: 'tool',
    id: callId,
    callId,
    name: 'Agent',
    status: 'running',
    input: { description: 'Survey adapters', prompt },
    output: null,
    summary: null,
  }
}

function agentResult(callId: string, text: string): FeedContent {
  return {
    kind: 'tool',
    id: `${callId}:result`,
    callId,
    name: '',
    status: 'completed',
    input: null,
    output: [{ kind: 'text', text }],
    summary: null,
  }
}

function delegationEnvelope(
  id: string,
  status: 'running' | 'completed',
  prompt = `Input ${id}`,
): FeedContent {
  return {
    kind: 'delegation',
    id,
    event: status === 'running' ? 'started' : 'responded',
    agentId: 'feed-review',
    status,
    name: null,
    prompt,
    model: null,
    summary: null,
  }
}

test('reads a foreground Agent result as its start and its reply', () => {
  const projection = new ClaudeFeedProjection()
  expect(projection.project(agentCall('call-1', 'Survey the adapters'))).toEqual([])
  const projected = projection.project(
    agentResult('call-1', 'Found two adapters.\nagentId: a1b2c3 (for resuming)\n<usage>1</usage>'),
  )
  expect(projected).toMatchObject([
    { id: 'call-1', event: 'started', status: 'running', prompt: 'Survey the adapters' },
    {
      id: 'call-1:response',
      event: 'responded',
      status: 'completed',
      prompt: null,
      summary: 'Found two adapters.',
    },
  ])
})

test('reads a background Agent launch as its start alone', () => {
  const projection = new ClaudeFeedProjection()
  projection.project(agentCall('call-2', 'Keep going'))
  expect(
    projection.project(agentResult('call-2', 'Async agent launched\nagentId: b2c3d4 (internal)')),
  ).toMatchObject([{ id: 'call-2', event: 'started', agentId: 'b2c3d4' }])
})

test('reads a repeated delegation envelope with a new input as a message to it', () => {
  const projection = new ClaudeFeedProjection()
  const events = ['first', 'second', 'third'].flatMap((id, index) =>
    projection.project(delegationEnvelope(id, index === 2 ? 'completed' : 'running')),
  )
  expect(events.map((event) => (event.kind === 'delegation' ? event.event : null))).toEqual([
    'started',
    'messaged',
    'responded',
  ])
})

test('records no event for a repeated delegation envelope with the same input', () => {
  const projection = new ClaudeFeedProjection()
  projection.project(delegationEnvelope('first', 'running', 'Review the Feed card'))
  expect(
    projection.project(delegationEnvelope('progress', 'running', 'Review the Feed card')),
  ).toEqual([])
})

function command(id: string, text: string): FeedContent {
  return {
    kind: 'command',
    id,
    command: text,
    status: 'completed',
    output: null,
    stderr: null,
  }
}

test('draws a Skill call as a skill row that names the skill only', () => {
  const projection = new ClaudeFeedProjection()
  const call: FeedContent = {
    kind: 'tool',
    id: 'message-1',
    callId: 'call-skill',
    name: 'Skill',
    status: 'running',
    input: { skill: 'implement', args: '2861' },
    output: null,
    summary: null,
  }

  expect(projection.project(call)).toEqual([
    {
      id: 'message-1',
      kind: 'reference',
      referenceType: 'skill',
      label: 'implement',
      target: null,
      text: '2861',
    },
  ])
  expect(projection.project({ ...call, id: 'call-skill:result', input: null })).toEqual([])
})

function todoCall(todos: Record<string, string>[]): Extract<FeedContent, { kind: 'tool' }> {
  return {
    kind: 'tool',
    id: 'message-1',
    callId: 'call-todo',
    name: 'TodoWrite',
    status: 'running',
    input: { todos },
    output: null,
    summary: null,
  }
}

test('draws a TodoWrite call as a Plan with its steps done and in total', () => {
  const projection = new ClaudeFeedProjection()
  const call = todoCall([
    { content: 'Read the code', status: 'completed', activeForm: 'Reading the code' },
    { content: 'Write the test', status: 'in_progress', activeForm: 'Writing the test' },
    { content: 'Ship it', status: 'pending', activeForm: 'Shipping it' },
  ])

  expect(projection.project(call)).toEqual([
    {
      id: 'message-1',
      kind: 'plan',
      text: '- Read the code\n- Write the test\n- Ship it',
      progress: { completed: 1, total: 3 },
    },
  ])
  expect(projection.project({ ...call, id: 'call-todo:result', input: null })).toEqual([])
})

test('leaves a TodoWrite call it cannot read as the tool call it is', () => {
  const call = todoCall([{ content: 'Read the code', status: 'skipped' }])

  expect(new ClaudeFeedProjection().project(call)).toEqual([call])
})

test('leaves a slash command as the command it ran', () => {
  const projection = new ClaudeFeedProjection()

  expect(projection.project(command('command-1', '/implement 2861'))).toEqual([
    command('command-1', '/implement 2861'),
  ])
})

// Recorded from claude 2.1.286 (Sonnet, low effort) asked to plan two tasks and finish one.
test('draws recorded TaskCreate and TaskUpdate calls as a Plan with one of two steps done', () => {
  const projection = new ClaudeFeedProjection()
  const plans = readFileSync(
    new URL('../../../../mocks/cli/claude/fixtures/claude-task-plan-stream.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .flatMap((line) => claudeFeedContent(JSON.parse(line) as SDKMessage, () => {}))
    .flatMap((content) => projection.project(content))
    .filter((content) => content.kind === 'plan')

  expect(plans.at(-1)).toMatchObject({
    text: '- Write hello.txt containing hi\n- Write bye.txt containing bye',
    progress: { completed: 1, total: 2 },
  })
})

test('leaves a TaskCreate whose result names no task as the tool call it is', () => {
  const projection = new ClaudeFeedProjection()
  const call = {
    ...todoCall([]),
    name: 'TaskCreate',
    input: { subject: 'Ship it', description: 'Ship it' },
  }
  const result = {
    ...call,
    id: 'call-todo:result',
    name: '',
    status: 'completed' as const,
    input: null,
    output: [{ kind: 'text' as const, text: 'No task' }],
  }

  expect(projection.project(call)).toEqual([])
  expect(projection.project(result)).toEqual([call, result])
})

test('waits past a TaskCreate progress frame and hides its later summary', () => {
  const projection = new ClaudeFeedProjection()
  const call = { ...todoCall([]), name: 'TaskCreate', input: { subject: 'Ship it' } }
  const frame = { ...call, id: 'call-todo:frame', input: null }
  const result = {
    ...frame,
    id: 'call-todo:result',
    status: 'completed' as const,
    output: [{ kind: 'text' as const, text: 'Task #1 created successfully: Ship it' }],
  }

  expect(projection.project(call)).toEqual([])
  expect(projection.project(frame)).toEqual([])
  expect(projection.project(result)).toMatchObject([{ kind: 'plan', text: '- Ship it' }])
  expect(projection.project({ ...frame, status: 'completed', summary: 'Made a task' })).toEqual([])
})
