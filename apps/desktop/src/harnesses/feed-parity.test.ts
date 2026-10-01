import { expect, test } from 'bun:test'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { projectLiveFeedRows } from '@/domains/sessions/api/feed/live-feed-rows'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeSessionMessages } from './claude/session/claude-session-history'
import type { CodexRequest, ThreadItem } from './codex/app-server'
import { readCodexPlan } from './codex/session/codex-feed'
import { readCodexSessionHistory } from './codex/session/codex-session-history'

// What a reader sees: every row with its ids dropped, since each Harness names its own items.
function drawn(history: readonly FeedContent[]): unknown[] {
  return JSON.parse(
    JSON.stringify(projectLiveFeedRows(history, []), (key, value) =>
      key === 'id' ? undefined : value,
    ),
  )
}

function claudeRows(records: readonly object[]): unknown[] {
  return drawn(
    decodeClaudeSessionMessages(
      records.map((record, index) => ({ uuid: `claude-${index}`, ...record }) as SessionMessage),
    ),
  )
}

async function codexRows(items: readonly ThreadItem[]): Promise<unknown[]> {
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread: { turns: [{ id: 'turn-1', items }] } })) as CodexRequest
  return drawn(await readCodexSessionHistory(request, 'thread-1'))
}

const user = (content: unknown) => ({ type: 'user', message: { role: 'user', content } })
const assistant = (content: unknown[]) => ({
  type: 'assistant',
  message: { role: 'assistant', content },
})
const bash = (id: string, command: string) => ({
  type: 'tool_use',
  id,
  name: 'Bash',
  input: { command },
})
const result = (id: string, text: string, isError = false) =>
  user([{ type: 'tool_result', tool_use_id: id, content: text, is_error: isError }])

type CommandFacts = Pick<
  Extract<ThreadItem, { type: 'commandExecution' }>,
  'id' | 'command' | 'status' | 'aggregatedOutput'
>

function codexCommand(facts: CommandFacts): ThreadItem {
  return {
    type: 'commandExecution',
    pluginId: null,
    scriptPath: null,
    cwd: '/repo',
    processId: null,
    source: 'agent',
    commandActions: [],
    exitCode: null,
    durationMs: null,
    ...facts,
  }
}

test('Claude and Codex draw the same rows for a prompt, a thought, commands, and a reply', async () => {
  const claude = claudeRows([
    user('Run the checks.'),
    assistant([{ type: 'thinking', thinking: 'Checking the suite.', signature: '' }]),
    assistant([bash('c1', 'bun test')]),
    result('c1', '1 pass 0 fail'),
    assistant([bash('c2', 'bun run lint')]),
    result('c2', '1 error', true),
    assistant([bash('c3', 'bun run build')]),
    assistant([{ type: 'text', text: 'Lint fails.' }]),
  ])
  const codex = await codexRows([
    {
      type: 'userMessage',
      id: 'u1',
      clientId: null,
      content: [{ type: 'text', text: 'Run the checks.', text_elements: [] }],
    },
    { type: 'reasoning', id: 'r1', summary: ['Checking the suite.'], content: [] },
    codexCommand({
      id: 'x1',
      command: 'bun test',
      status: 'completed',
      aggregatedOutput: '1 pass 0 fail',
    }),
    codexCommand({
      id: 'x2',
      command: 'bun run lint',
      status: 'failed',
      aggregatedOutput: '1 error',
    }),
    codexCommand({
      id: 'x3',
      command: 'bun run build',
      status: 'inProgress',
      aggregatedOutput: null,
    }),
    {
      type: 'agentMessage',
      id: 'a1',
      text: 'Lint fails.',
      phase: null,
      memoryCitation: null,
      delivery: null,
      questions: null,
    },
  ])
  expect(claude).toEqual(codex)
  expect(claude).toContainEqual(
    expect.objectContaining({ shape: 'tool', label: 'Ran bun test', text: 'bun test' }),
  )
})

const todoPlan = [
  assistant([
    {
      type: 'tool_use',
      id: 't1',
      name: 'TodoWrite',
      input: {
        todos: [
          { content: 'Read the code', status: 'completed', activeForm: 'Reading' },
          { content: 'Write the test', status: 'in_progress', activeForm: 'Writing' },
        ],
      },
    },
  ]),
]
const taskCreate = (id: string, subject: string) => ({
  type: 'tool_use',
  id,
  name: 'TaskCreate',
  input: { subject, description: subject },
})
const taskPlan = [
  assistant([taskCreate('c1', 'Read the code')]),
  result('c1', 'Task #1 created successfully: Read the code'),
  assistant([taskCreate('c2', 'Write the test')]),
  result('c2', 'Task #2 created successfully: Write the test'),
  assistant([
    { type: 'tool_use', id: 'u1', name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } },
  ]),
  result('u1', 'Updated task #1 status'),
]

test.each([
  ['TodoWrite', todoPlan],
  ['TaskCreate and TaskUpdate', taskPlan],
])(
  'Claude %s and Codex give the same Plan and step count for the same steps',
  (_tools, records) => {
    const claude = decodeClaudeSessionMessages(
      records.map((record, index) => ({ uuid: `claude-${index}`, ...record }) as SessionMessage),
    ).findLast((content) => content.kind === 'plan')
    const codex = readCodexPlan({
      threadId: 'thread-1',
      turnId: 'turn-1',
      explanation: null,
      plan: [
        { step: 'Read the code', status: 'completed' },
        { step: 'Write the test', status: 'inProgress' },
      ],
    })?.content
    const { id: _claudeId, ...claudePlan } = claude ?? { id: '' }
    const { id: _codexId, ...codexPlan } = codex ?? { id: '' }
    expect(claudePlan).toEqual(codexPlan)
    expect(codexPlan).toMatchObject({ kind: 'plan', progress: { completed: 1, total: 2 } })
  },
)
