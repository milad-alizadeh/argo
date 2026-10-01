import { expect, test, vi } from 'vitest'
import { HISTORY_READ_SLOTS, HistoryReadLimit } from '@/domains/sessions/main/feed'
import { mockTurnsRequest } from '@/mocks/cli/codex/mock-codex-turn-pages'
import {
  recordedCalls,
  recordedThread,
  recordedThreadRequest,
} from '@/mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '@/mocks/cli/recorded-prompts'
import { recordedCodexSubagents } from '@/mocks/recordings/codex-app-server'
import type { CodexRequest, ThreadTurnsListParams } from '../app-server'
import { hasCodexSessionTurn, readCodexSessionHistory } from './codex-session-history'

function warningSpy() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

function singleItemRequest(item: Record<string, unknown>): CodexRequest {
  return threadRequest({ thread: { turns: [{ items: [item] }] } })
}

// A read of the thread metadata and then of each page, as a recorded thread answers them.
function threadRequest(read: {
  thread: { turns: ({ items: unknown[] } & Record<string, unknown>)[] }
}): CodexRequest {
  return mockTurnsRequest(read.thread.turns)
}

test('projects a recorded Codex thread into Feed content', async () => {
  const thread = recordedThread(RECORDED_PROMPTS.codexReply)
  const calls: unknown[] = []
  const recorded = recordedThreadRequest(thread)
  const request = (async (method, params, parse) => {
    calls.push({ method, params })
    return recorded(method, params, parse)
  }) as CodexRequest

  const reply = thread.turns
    .flatMap((turn) => turn.items)
    .findLast((item) => item.type === 'agentMessage')
  if (reply?.type !== 'agentMessage') throw new Error('The recorded Codex thread has no reply.')
  const content = await readCodexSessionHistory(request, thread.id)
  expect(content.at(0)).toEqual(
    expect.objectContaining({ kind: 'message', role: 'user', text: RECORDED_PROMPTS.codexReply }),
  )
  expect(content.at(-1)).toEqual({
    kind: 'message',
    id: reply.id,
    role: 'assistant',
    phase: 'final_answer',
    text: reply.text,
  })
  const recordedTurnId = thread.turns[0]?.id
  if (recordedTurnId === undefined) throw new Error('The recorded Codex turn is missing.')
  await expect(hasCodexSessionTurn(request, thread.id, recordedTurnId)).resolves.toBe(true)
  await expect(hasCodexSessionTurn(request, thread.id, 'missing-turn')).resolves.toBe(false)
  const page = { threadId: thread.id, limit: 50, cursor: null }
  expect(calls).toEqual([
    { method: 'thread/turns/list', params: { ...page, itemsView: 'full', sortDirection: 'asc' } },
    {
      method: 'thread/turns/list',
      params: { ...page, itemsView: 'notLoaded', sortDirection: 'desc' },
    },
    {
      method: 'thread/turns/list',
      params: { ...page, itemsView: 'notLoaded', sortDirection: 'desc' },
    },
  ])
})

// The recorded pages hold one Turn each and link them with the cursor Codex gave.
function recordedPagesRequest(): CodexRequest {
  return (async (method: string, params: ThreadTurnsListParams, parse) => {
    const page = recordedCalls('thread/turns/list').find(
      (call) => call.params.threadId === params.threadId && call.params.cursor === params.cursor,
    )
    if (method !== 'thread/turns/list' || page === undefined)
      throw new Error(`No recorded answer to ${method}.`)
    return parse(page.result)
  }) as CodexRequest
}

test('reads every recorded page of a thread with two Turns', async () => {
  const thread = recordedThread(RECORDED_PROMPTS.codexCommand)
  const pages = recordedCalls('thread/turns/list').filter(
    (call) => call.params.threadId === thread.id,
  )
  expect(pages.length).toBeGreaterThan(1)
  const content = await readCodexSessionHistory(recordedPagesRequest(), thread.id)
  const prompts = content.flatMap((entry) =>
    entry.kind === 'message' && entry.role === 'user' ? [entry.text] : [],
  )
  expect(prompts).toEqual([RECORDED_PROMPTS.codexCommand, RECORDED_PROMPTS.codexFollowUp])
  await expect(readCodexSessionHistory(recordedThreadRequest(thread), thread.id)).resolves.toEqual(
    content,
  )
})

test('stops at the first page that holds the Turn, newest first', async () => {
  const turns = Array.from({ length: 120 }, () => ({ items: [] }))
  const pages = mockTurnsRequest(turns)
  let requests = 0
  const request = (async (method, params, parse) => {
    requests += 1
    return pages(method, params, parse)
  }) as CodexRequest
  await expect(hasCodexSessionTurn(request, 'thread', 'turn-120')).resolves.toBe(true)
  expect(requests).toBe(1)
  requests = 0
  await expect(hasCodexSessionTurn(request, 'thread', 'turn-1')).resolves.toBe(true)
  expect(requests).toBe(3)
  requests = 0
  await expect(hasCodexSessionTurn(request, 'thread', 'turn-121')).resolves.toBe(false)
  expect(requests).toBe(3)
})

test('throws on a page cursor that comes back and frees its history read slot', async () => {
  const warning = warningSpy()
  const request = (async (_method, _params, parse) =>
    parse({ data: [], nextCursor: 'same-cursor' })) as CodexRequest
  const limit = new HistoryReadLimit()
  const reads = Array.from({ length: HISTORY_READ_SLOTS }, () =>
    limit.run(() => readCodexSessionHistory(request, 'thread')),
  )
  for (const read of reads) await expect(read).rejects.toThrow(/repeated a page cursor/)
  await expect(limit.run(async () => 'next read')).resolves.toBe('next read')
  expect(warning).toHaveBeenCalledWith('Stopped a Codex history read whose page cursor repeated.')
  warning.mockRestore()
})

test('shows known markers and rejects unrecognized item types', async () => {
  const request = threadRequest({
    thread: {
      turns: [{ items: [{ id: 'compaction', type: 'contextCompaction' }] }],
    },
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    { kind: 'marker', id: 'compaction', marker: 'compaction', summary: null },
  ])

  const unknownRequest = threadRequest({
    thread: { turns: [{ items: [{ id: 'future', type: 'futureItem' }] }] },
  })
  const warning = warningSpy()
  await expect(readCodexSessionHistory(unknownRequest, 'thread')).resolves.toEqual([
    {
      kind: 'diagnostic',
      id: 'future',
      vendorType: 'futureItem',
      detail: 'Unsupported Codex thread item.',
    },
  ])
  expect(warning).toHaveBeenCalledWith('Rejected 1 unsupported Codex history shape(s).')
  warning.mockRestore()
})

test('reads Codex reasoning, commentary, file edits, and MCP results from thread items', async () => {
  const request = threadRequest({
    thread: {
      turns: [
        {
          id: 'turn-1',
          items: [
            { id: 'reason-1', type: 'reasoning', summary: ['Checking the Feed contract'] },
            {
              id: 'progress-1',
              type: 'agentMessage',
              text: 'Reading files',
              phase: 'commentary',
            },
            {
              id: 'edit-1',
              type: 'fileChange',
              status: 'completed',
              changes: [
                { path: '/repo/feed.ts', diff: '+updated', kind: { type: 'update' } },
                {
                  path: '/repo/old.ts',
                  diff: '',
                  kind: { type: 'update', move_path: '/repo/new.ts' },
                },
              ],
            },
            {
              id: 'mcp-1',
              type: 'mcpToolCall',
              server: 'files',
              tool: 'read',
              status: 'completed',
              arguments: { path: '/repo/feed.ts' },
              result: { content: [{ type: 'text', text: 'updated' }] },
            },
            { id: 'answer-1', type: 'agentMessage', text: 'Done', phase: 'final_answer' },
          ],
        },
      ],
    },
  })
  const content = await readCodexSessionHistory(request, 'thread')
  expect(content).toMatchObject([
    { kind: 'reasoning', id: 'reason-1', text: 'Checking the Feed contract' },
    { kind: 'message', id: 'progress-1', phase: 'commentary' },
    {
      kind: 'fileChange',
      id: 'edit-1',
      changes: [
        { path: '/repo/feed.ts', change: 'update' },
        { path: '/repo/old.ts', change: 'update', movedTo: '/repo/new.ts' },
      ],
    },
    { kind: 'tool', id: 'mcp-1', output: [{ kind: 'text', text: 'updated' }] },
    { kind: 'message', id: 'answer-1', phase: 'final_answer' },
  ])
})

test('shows the image-generation usage limit and reset reported by Codex', async () => {
  const request = threadRequest({
    thread: {
      turns: [
        {
          items: [
            {
              id: 'image-call',
              type: 'imageGeneration',
              status: 'failed',
              revisedPrompt: 'paint a blue whale',
              result: '',
              failure: {
                type: 'usageLimitExceeded',
                limitId: 'image_gen',
                resetsAt: 1_786_150_800,
              },
            },
            {
              id: 'image-call-without-reset',
              type: 'imageGeneration',
              status: 'failed',
              revisedPrompt: null,
              result: '',
              failure: { type: 'usageLimitExceeded', limitId: 'image_gen' },
            },
          ],
        },
      ],
    },
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    {
      kind: 'imageGeneration',
      id: 'image-call',
      status: 'failed',
      prompt: 'paint a blue whale',
      source: null,
      failure: 'Image generation usage limit exceeded. Resets at 2026-08-08T01:00:00.000Z.',
    },
    {
      kind: 'imageGeneration',
      id: 'image-call-without-reset',
      status: 'failed',
      prompt: null,
      source: null,
      failure: 'Image generation usage limit exceeded.',
    },
  ])
})

test('rejects and reports an unknown Codex image-generation status', async () => {
  const warning = warningSpy()
  const request = singleItemRequest({
    id: 'image-1',
    type: 'imageGeneration',
    status: 'futureStatus',
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    {
      kind: 'diagnostic',
      id: 'image-1',
      vendorType: 'imageGeneration:futureStatus',
      detail: 'Unsupported Codex thread item.',
    },
  ])
  expect(warning).toHaveBeenCalledWith('Rejected 1 unsupported Codex history shape(s).')
  warning.mockRestore()
})

test('folds a Codex image into the prompt row and keeps a raw attachment path out of its text', async () => {
  const request = threadRequest({
    thread: {
      turns: [
        {
          items: [
            {
              id: 'user-image',
              type: 'userMessage',
              clientId: null,
              content: [
                { type: 'text', text: 'Check this screenshot', text_elements: [] },
                { type: 'localImage', path: '/tmp/screenshot.png' },
                {
                  type: 'text',
                  text: '/tmp/report.pdf',
                  text_elements: [
                    { byteRange: { start: 0, end: 15 }, placeholder: '/tmp/report.pdf' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    {
      kind: 'message',
      id: 'user-image',
      role: 'user',
      text: 'Check this screenshot',
      images: [{ kind: 'path', path: '/tmp/screenshot.png' }],
      files: [{ label: 'report.pdf', target: '/tmp/report.pdf' }],
    },
  ])
})

test('draws a Codex skill use as a skill row and keeps its link out of the prompt', async () => {
  const request = threadRequest({
    thread: {
      turns: [
        {
          items: [
            {
              id: 'user-skill',
              type: 'userMessage',
              clientId: null,
              content: [
                {
                  type: 'text',
                  text: 'Use [$review](/repo/.agents/skills/review/SKILL.md) on this branch',
                  text_elements: [],
                },
                { type: 'skill', name: 'review', path: '/repo/.agents/skills/review/SKILL.md' },
              ],
            },
          ],
        },
      ],
    },
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    {
      kind: 'reference',
      id: 'user-skill:skill:0',
      referenceType: 'skill',
      label: 'review',
      target: '/repo/.agents/skills/review/SKILL.md',
      text: null,
    },
    { kind: 'message', id: 'user-skill', role: 'user', text: 'Use on this branch' },
  ])
})

test('shows a Codex image-only prompt with no text', async () => {
  const request = threadRequest({
    thread: {
      turns: [
        {
          items: [
            {
              id: 'user-image-only',
              type: 'userMessage',
              clientId: null,
              content: [{ type: 'localImage', path: '/tmp/only.png' }],
            },
          ],
        },
      ],
    },
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    {
      kind: 'message',
      id: 'user-image-only',
      role: 'user',
      text: '',
      images: [{ kind: 'path', path: '/tmp/only.png' }],
    },
  ])
})

test('reports and drops a Codex image sent by fileId, keeping the rest of the prompt', async () => {
  const warning = warningSpy()
  const request = singleItemRequest({
    id: 'user-fileid-image',
    type: 'userMessage',
    clientId: null,
    content: [
      { type: 'text', text: 'Check this upload', text_elements: [] },
      { type: 'image', fileId: 'file-123' },
    ],
  })
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    { kind: 'message', id: 'user-fileid-image', role: 'user', text: 'Check this upload' },
  ])
  expect(warning).toHaveBeenCalledWith('Rejected 1 unsupported Codex history shape(s).')
  warning.mockRestore()
})

test('reads each recorded Subagent activity as its own delegation event', async () => {
  const recorded = recordedCodexSubagents
  const request = threadRequest({ thread: recorded.thread })
  const delegation = (
    id: string,
    event: 'started' | 'messaged' | 'responded',
    status: 'running' | 'completed' | 'interrupted',
  ) => ({
    kind: 'delegation',
    id,
    event,
    agentId: 'thread-child-review',
    status,
    name: 'spec_review',
    prompt: null,
    model: null,
    summary: null,
  })
  await expect(readCodexSessionHistory(request, 'thread-parent')).resolves.toEqual([
    { kind: 'message', id: 'user-1', role: 'user', text: 'Review the branch' },
    delegation('call_spawn_review', 'started', 'running'),
    delegation('subagent-completed-review-1', 'responded', 'completed'),
    delegation('call_message_review', 'messaged', 'running'),
    delegation('call_interrupt_review', 'responded', 'interrupted'),
    { kind: 'message', id: 'agent-1', role: 'assistant', text: 'The review is in.' },
  ])
})

test('gives a Subagent start the prompt and model its spawn call sent', async () => {
  const items = [
    {
      type: 'collabAgentToolCall',
      id: 'call_spawn',
      tool: 'spawnAgent',
      status: 'completed',
      senderThreadId: 'thread-parent',
      receiverThreadIds: ['thread-child'],
      prompt: 'Review the branch',
      model: 'gpt-5',
      reasoningEffort: null,
      agentsStates: {},
    },
    {
      type: 'subAgentActivity',
      id: 'call_spawn',
      kind: 'started',
      agentThreadId: 'thread-child',
      agentPath: '/root/reviewer',
    },
  ]
  const request = threadRequest({ thread: { turns: [{ items }] } })
  await expect(readCodexSessionHistory(request, 'thread-parent')).resolves.toEqual([
    expect.objectContaining({
      kind: 'delegation',
      event: 'started',
      prompt: 'Review the branch',
      model: 'gpt-5',
    }),
  ])
})

const SPAWNED_ITEMS = [
  {
    type: 'subAgentActivity',
    id: 'call_spawn',
    kind: 'started',
    agentThreadId: 'thread-child',
    agentPath: '/root/spec_review',
  },
]

test('names a Subagent with the nickname its own thread carries', async () => {
  const parent = mockTurnsRequest([{ items: SPAWNED_ITEMS }])
  const request = (async (method: string, params: { threadId: string }, parse) =>
    params.threadId === 'thread-child'
      ? parse({ thread: { agentNickname: 'Jason', turns: [] } })
      : parent(method as 'thread/turns/list', params as never, parse)) as CodexRequest
  await expect(readCodexSessionHistory(request, 'thread-parent')).resolves.toEqual([
    expect.objectContaining({ name: 'spec_review', nickname: 'Jason' }),
  ])
})

test('keeps a Subagent row without a nickname when its thread cannot be read', async () => {
  const warning = warningSpy()
  const parent = mockTurnsRequest([{ items: SPAWNED_ITEMS }])
  const request = (async (method: string, params: { threadId: string }, parse) => {
    if (params.threadId === 'thread-child') throw new Error('not found')
    return parent(method as 'thread/turns/list', params as never, parse)
  }) as CodexRequest
  const [content] = await readCodexSessionHistory(request, 'thread-parent')
  expect(content).toMatchObject({ name: 'spec_review' })
  expect(content).not.toHaveProperty('nickname')
  expect(warning).toHaveBeenCalledWith(
    'Could not read 1 Codex Subagent thread; it shows no nickname.',
  )
  warning.mockRestore()
})
