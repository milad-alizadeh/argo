import { afterEach, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { scanRollouts } from '../../../../mocks/cli/codex/mock-codex-rollout-history.ts'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { openCodexHistoryReader } from './codex-history-lines'
import { readCodexSessionHistory } from './codex-session-history'

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
        '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"Reasoning","id":"rs"}}}',
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

test('asks for a full read when a rollout completes a command', () => {
  expect(
    openCodexHistoryReader()([
      '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"AgentMessage","id":"m","content":[{"type":"Text","text":"Running it"}]}}}',
      '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"CommandExecution","id":"c","command":"ls"}}}',
    ]),
  ).toEqual({ type: 'rewritten' })
})

test('asks for a full read when a rollout completes a file edit', () => {
  expect(
    openCodexHistoryReader()([
      '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"FileChange","id":"e","changes":{"/repo/app.txt":{"type":"update","unified_diff":"@@ -1 +1 @@\\n-beta\\n+gamma\\n","move_path":null}},"status":"completed"}}}',
    ]),
  ).toEqual({ type: 'rewritten' })
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
