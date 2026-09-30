import { afterEach, expect, test } from 'bun:test'
import {
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { latestTurn } from '@/harnesses/host/history-watch'
import { scanRollouts } from '../../../../mocks/cli/codex/mock-codex-rollout-history.ts'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { codexHistoryOwner, codexHistoryTurn, openCodexHistoryReader } from './codex-history-lines'
import type { ThreadItem } from '../app-server'
import { codexContentFromItems, readCodexSessionHistory } from './codex-session-history'

const FIXTURES = fileURLToPath(
  new URL('../../../../mocks/cli/codex/fixtures/sessions', import.meta.url),
)
const previous = process.env.ARGO_CODEX_TRANSCRIPTS

function userMessageThread(text: string): CodexRequest {
  return (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
      thread: {
        id: 'codex-notice-thread',
        turns: [
          {
            id: 'turn-1',
            items: [{ type: 'userMessage', id: 'codex-notice', content: [{ type: 'text', text }] }],
          },
        ],
      },
    })) as CodexRequest
}

function streamedUserMessage(text: string): FeedContent[] {
  const streamed = openCodexHistoryReader()([
    JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        item: { type: 'UserMessage', id: 'codex-notice', content: [{ type: 'text', text }] },
      },
    }),
  ])
  if (streamed.type !== 'appended') throw new Error('The rollout did not stream.')
  return streamed.events.flatMap((event) => (event.type === 'content' ? [event.content] : []))
}

afterEach(() => {
  if (previous === undefined) delete process.env.ARGO_CODEX_TRANSCRIPTS
  else process.env.ARGO_CODEX_TRANSCRIPTS = previous
})

const rollouts = readdirSync(FIXTURES).filter((name) => name.startsWith('rollout-'))

test.each(rollouts)('streams %s as the messages a full thread read returns', async (name) => {
  process.env.ARGO_CODEX_TRANSCRIPTS = FIXTURES
  const threadId = path.basename(name, '.jsonl')
  const thread = scanRollouts().find((candidate) => candidate.id === threadId)
  if (thread === undefined) throw new Error(`The recorded Codex thread ${threadId} is missing.`)
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread })) as CodexRequest
  const full = await readCodexSessionHistory(request, threadId)
  const lines = readFileSync(path.join(FIXTURES, name), 'utf8').split('\n').filter(Boolean)

  const streamed = openCodexHistoryReader()(lines)

  if (streamed.type !== 'appended') throw new Error('The rollout did not stream.')
  // The mock's thread read keeps a user message's surrounding whitespace; the app-server trims it.
  const trimmed = (content: FeedContent) =>
    content.kind === 'message' ? { ...content, text: content.text.trim() } : content
  expect(
    streamed.events.map((event) => (event.type === 'content' ? trimmed(event.content) : null)),
  ).toEqual(full.map(trimmed))
})

test('counts a line that is not a rollout record', () => {
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    expect(
      openCodexHistoryReader()([
        '{"type":"turn_context","payload":{"turn_id":"t"}}',
        '{"type":"event_msg","payload":{"type":"token_count","info":null}}',
        'not json',
      ]),
    ).toEqual({ type: 'appended', events: [] })
  } finally {
    console.warn = warn
  }
  expect(warnings).toEqual(['Rejected 1 unsupported Codex rollout line(s).'])
})

test('reads a user task notification as the task a full thread read returns', async () => {
  const text =
    '<task-notification><task-id>t2</task-id><status>completed</status><summary>Task finished</summary></task-notification>'
  const full = await readCodexSessionHistory(userMessageThread(text), 'codex-notice-thread')
  const task = {
    id: 'codex-notice',
    kind: 'task' as const,
    taskId: 't2',
    callId: null,
    status: 'completed' as const,
    description: null,
    summary: 'Task finished',
  }
  expect(full).toEqual([task])
  expect(streamedUserMessage(text)).toEqual([task])
})

test('counts a task notification whose status is not one Codex publishes', async () => {
  const text =
    '<task-notification><task-id>t2</task-id><status>nope</status><summary>Task finished</summary></task-notification>'
  const diagnostic = {
    id: 'codex-notice',
    kind: 'diagnostic' as const,
    vendorType: 'task-notification',
    detail: 'Unknown task status.',
  }
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    const full = await readCodexSessionHistory(userMessageThread(text), 'codex-notice-thread')
    expect(full).toEqual([diagnostic])
    expect(streamedUserMessage(text)).toEqual([diagnostic])
  } finally {
    console.warn = warn
  }
  expect(warnings).toEqual([
    'Rejected 1 unsupported Codex task notification.',
    'Rejected 1 unsupported Codex rollout line(s).',
  ])
})

function completed(item: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'event_msg',
    payload: { type: 'item_completed', turn_id: 'turn-1', item },
  })
}

function contents(change: ReturnType<ReturnType<typeof openCodexHistoryReader>>) {
  return change.events.flatMap((event) => (event.type === 'content' ? [event.content] : []))
}

// Each pair is one item as a rollout records it and as `thread/read` returned it.
const workItems = [
  {
    rollout: {
      type: 'CommandExecution',
      id: 'exec-1',
      process_id: '1814',
      command: ['/bin/zsh', '-lc', "rg -n 'watch|tail' src"],
      cwd: 'file:///Users/reader/argo',
      parsed_cmd: [{ type: 'unknown', cmd: "rg -n 'watch|tail' src" }],
      source: 'unified_exec_startup',
      status: 'failed',
      stdout: '',
      stderr: '',
      aggregated_output: 'no matches',
      exit_code: 1,
      duration: { secs: 0, nanos: 7791 },
      formatted_output: '',
    },
    read: {
      type: 'commandExecution',
      id: 'exec-1',
      pluginId: null,
      scriptPath: null,
      command: `/bin/zsh -lc "rg -n 'watch|tail' src"`,
      cwd: '/Users/reader/argo',
      processId: '1814',
      source: 'unifiedExecStartup',
      status: 'failed',
      commandActions: [],
      aggregatedOutput: 'no matches',
      exitCode: 1,
      durationMs: 0,
    },
  },
  {
    rollout: {
      type: 'FileChange',
      id: 'edit-1',
      changes: {
        '/repo/app.txt': { type: 'update', unified_diff: '@@ -1 +1 @@\n-beta\n+gamma\n', move_path: null },
        '/repo/new.txt': { type: 'add', content: 'new\n' },
      },
      status: 'completed',
      stdout: 'Success.',
      stderr: '',
    },
    read: {
      type: 'fileChange',
      id: 'edit-1',
      changes: [
        {
          path: '/repo/app.txt',
          kind: { type: 'update', move_path: null },
          diff: '@@ -1 +1 @@\n-beta\n+gamma\n',
        },
        { path: '/repo/new.txt', kind: { type: 'add' }, diff: 'new\n' },
      ],
      status: 'completed',
    },
  },
  {
    rollout: {
      type: 'McpToolCall',
      id: 'mcp-1',
      server: 'codex_app',
      tool: 'open_in_codex',
      arguments: { target: { type: 'file', path: '/repo/README.md' } },
      pluginId: 'codex-app-tools@openai-bundled',
      status: 'completed',
      result: { content: [{ type: 'text', text: '{"status":"queued"}' }], isError: false },
      duration: { secs: 0, nanos: 75 },
    },
    read: {
      type: 'mcpToolCall',
      id: 'mcp-1',
      server: 'codex_app',
      tool: 'open_in_codex',
      status: 'completed',
      arguments: { target: { type: 'file', path: '/repo/README.md' } },
      appContext: null,
      mcpAppUi: null,
      pluginId: 'codex-app-tools@openai-bundled',
      readOnlyHint: null,
      result: {
        content: [{ type: 'text', text: '{"status":"queued"}' }],
        structuredContent: null,
        _meta: null,
      },
      error: null,
      durationMs: 75,
    },
  },
  {
    rollout: {
      type: 'Extension',
      kind: 'web.search',
      id: 'search-1',
      query: 'codex app server',
      action: { type: 'search', query: null, queries: ['codex app server'] },
      results: [],
    },
    read: {
      type: 'webSearch',
      id: 'search-1',
      query: 'codex app server',
      action: { type: 'search', query: null, queries: ['codex app server'] },
      results: [],
    },
  },
  {
    rollout: {
      type: 'Reasoning',
      id: 'rs-1',
      summary_text: ['Tracing the watcher'],
      raw_content: [],
    },
    read: { type: 'reasoning', id: 'rs-1', summary: ['Tracing the watcher'], content: [] },
  },
] as const

test.each(workItems.map((pair) => [pair.rollout.type, pair] as const))(
  'decodes a completed %s as thread/read does',
  (_type, { rollout, read }) => {
    const change = openCodexHistoryReader()([completed(rollout)])

    expect(contents(change)).toEqual(codexContentFromItems([read as unknown as ThreadItem]))
  },
)

test('asks for a full read when a rollout completes a command or an edit', () => {
  const [command, edit] = workItems
  const read = openCodexHistoryReader()

  expect(read([completed(command.rollout)]).type).toBe('rewritten')
  expect(read([completed(edit.rollout)]).type).toBe('rewritten')
  expect(read([completed(workItems[4].rollout)]).type).toBe('appended')
})

test('keeps the phase of an agent message', () => {
  const change = openCodexHistoryReader()([
    completed({
      type: 'AgentMessage',
      id: 'm',
      content: [{ type: 'Text', text: 'Tracing it' }],
      phase: 'commentary',
    }),
  ])

  expect(contents(change)).toEqual([
    { kind: 'message', id: 'm', role: 'assistant', text: 'Tracing it', phase: 'commentary' },
  ])
})

test('rejects and counts a work item in a shape it cannot read', () => {
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    const change = openCodexHistoryReader()([
      completed({ type: 'CommandExecution', id: 'c', command: 'ls' }),
      completed({ type: 'Extension', kind: 'clock.sleep', id: 's', durationMs: 10 }),
    ])
    expect(change).toEqual({ type: 'rewritten', events: [] })
  } finally {
    console.warn = warn
  }
  expect(warnings).toEqual(['Rejected 1 unsupported Codex rollout line(s).'])
})

test('names the thread a rollout file belongs to', () => {
  expect(
    codexHistoryOwner(
      '2026/09/28/rollout-2026-09-28T17-28-10-01a0e8d8-6461-7692-b276-32329518363e.jsonl',
    ),
  ).toBe('01a0e8d8-6461-7692-b276-32329518363e')
  expect(codexHistoryOwner('2026/09/10/rollout-codexChild.jsonl')).toBe('rollout-codexChild')
  expect(codexHistoryOwner('2026/09/10/session_index.jsonl')).toBeNull()
  expect(codexHistoryOwner('2026/09/10')).toBeNull()
})

test.each([
  ['task_started', 'open'],
  ['task_complete', 'closed'],
  ['turn_aborted', 'closed'],
  ['token_count', null],
] as const)('reads a %s event as a turn that is %p', (type, turn) => {
  expect(
    codexHistoryTurn(JSON.stringify({ type: 'event_msg', payload: { type, turn_id: 'turn-1' } })),
  ).toEqual(turn === null ? null : { turn, turnId: 'turn-1' })
})

test('reads a marker without a turn id as one that names no turn', () => {
  expect(
    codexHistoryTurn(JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } })),
  ).toEqual({ turn: 'closed', turnId: null })
})

// Codex aborts a replaced turn after it starts the next one; the late abort must not end it.
test('keeps a watched Session running when an earlier turn closes after the next starts', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-turn-'))
  try {
    const file = path.join(directory, 'rollout-codexReplacedTurn.jsonl')
    copyFileSync(path.join(FIXTURES, 'rollout-codexReplacedTurn.jsonl'), file)
    expect(latestTurn(file, codexHistoryTurn)).toBe('open')

    appendFileSync(
      file,
      `${JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_complete', turn_id: '01a0b000-0000-7000-8000-00000000b002' },
      })}\n`,
    )
    expect(latestTurn(file, codexHistoryTurn)).toBe('closed')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('reads a line that is not an event as no turn change', () => {
  expect(codexHistoryTurn('{"type":"response_item","payload":{"type":"message"}}')).toBeNull()
  expect(codexHistoryTurn('not json')).toBeNull()
})

// The live count follows a Codex Session the same way it follows a Claude one (#2861).
test('reads a Subagent activity a rollout appended as delegation content', () => {
  const lines = readFileSync(path.join(FIXTURES, 'rollout-paritySubagent.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
  const change = openCodexHistoryReader()(lines)
  if (change.type !== 'appended') throw new Error(`Expected appended lines, got ${change.type}.`)

  expect(
    change.events.flatMap((event) =>
      event.type === 'content' && event.content.kind === 'delegation'
        ? [[event.content.agentId, event.content.status, event.content.name]]
        : [],
    ),
  ).toEqual([
    ['par-thread', 'running', 'review_feed'],
    ['par-thread', 'running', 'review_feed'],
    ['par-thread', 'completed', 'review_feed'],
  ])
})

test('rejects a Subagent activity whose rollout record names an unknown kind', () => {
  const change = openCodexHistoryReader()([
    JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        item: {
          type: 'SubAgentActivity',
          id: 'sa-1',
          kind: 'teleported',
          agent_thread_id: 'thread-1',
          agent_path: '/root/review',
        },
      },
    }),
  ])
  if (change.type !== 'appended') throw new Error(`Expected appended lines, got ${change.type}.`)

  expect(change.events).toEqual([])
})
