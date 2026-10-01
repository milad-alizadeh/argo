import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { recordedThread } from '@/mocks/cli/codex/recorded-codex-threads'
import type { CodexRequest } from '../app-server'
import { hasCodexSessionTurn, readCodexSessionHistory } from './codex-session-history'

function warningSpy() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

function singleItemRequest(item: Record<string, unknown>): CodexRequest {
  return (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread: { turns: [{ items: [item] }] } })) as CodexRequest
}

test('projects a recorded Codex thread read into Feed content', async () => {
  const thread = recordedThread('Continue the check')
  const calls: unknown[] = []
  const request = (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    return parse({ thread })
  }) as CodexRequest

  await expect(readCodexSessionHistory(request, thread.id)).resolves.toEqual([
    {
      kind: 'message',
      id: '01a0f545-019e-7e03-ac98-6120375c2fa9',
      role: 'user',
      text: 'Continue the check',
    },
    {
      kind: 'reasoning',
      id: 'rs_037b94ca171276d5016abdc3d888d487d282beafdedfd5156c',
      redacted: false,
      text: null,
    },
    {
      kind: 'message',
      id: 'msg_037b94ca171276d5016abdc3d92b3087d29b6307627c7a1279',
      role: 'assistant',
      phase: 'final_answer',
      text: 'What would you like me to continue checking? Please share the file, command, or previous check you mean.',
    },
  ])
  const recordedTurnId = thread.turns[0]?.id
  if (recordedTurnId === undefined) throw new Error('The recorded Codex turn is missing.')
  await expect(hasCodexSessionTurn(request, thread.id, recordedTurnId)).resolves.toBe(true)
  await expect(hasCodexSessionTurn(request, thread.id, 'missing-turn')).resolves.toBe(false)
  const read = { method: 'thread/read', params: { threadId: thread.id, includeTurns: true } }
  expect(calls).toEqual([read, read, read])
})

test('shows known markers and rejects unrecognized item types', async () => {
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
      thread: {
        turns: [{ items: [{ id: 'compaction', type: 'contextCompaction' }] }],
      },
    })) as CodexRequest
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([
    { kind: 'marker', id: 'compaction', marker: 'compaction', summary: null },
  ])

  const unknownRequest = (async (
    _method: string,
    _params: unknown,
    parse: (value: unknown) => unknown,
  ) =>
    parse({
      thread: { turns: [{ items: [{ id: 'future', type: 'futureItem' }] }] },
    })) as CodexRequest
  await expect(readCodexSessionHistory(unknownRequest, 'thread')).rejects.toThrow()
})

test('reads Codex reasoning, commentary, file edits, and MCP results from thread items', async () => {
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
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
    })) as CodexRequest
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
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
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
    })) as CodexRequest
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
  await expect(readCodexSessionHistory(request, 'thread')).rejects.toThrow()
  expect(warning).toHaveBeenCalledWith('Rejected 1 unsupported Codex history shape.')
  warning.mockRestore()
})

test('folds a Codex image into the prompt row and keeps a raw attachment path out of its text', async () => {
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
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
    })) as CodexRequest
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
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
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
    })) as CodexRequest
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
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
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
    })) as CodexRequest
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
  expect(warning).toHaveBeenCalledWith(
    'Rejected 1 unsupported Codex prompt shape: image by fileId.',
  )
  warning.mockRestore()
})

test('reads each recorded Subagent activity as its own delegation event', async () => {
  const recorded = JSON.parse(
    readFileSync(
      new URL(
        '../../../../mocks/cli/codex/fixtures/thread-read-subagents-codex-0.157.0.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { thread: unknown }
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread: recorded.thread })) as CodexRequest
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
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread: { turns: [{ items }] } })) as CodexRequest
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
  const request = (async (_method: string, params: unknown, parse: (value: unknown) => unknown) =>
    parse(
      (params as { threadId: string }).threadId === 'thread-child'
        ? { thread: { agentNickname: 'Jason', turns: [] } }
        : { thread: { agentNickname: null, turns: [{ items: SPAWNED_ITEMS }] } },
    )) as CodexRequest
  await expect(readCodexSessionHistory(request, 'thread-parent')).resolves.toEqual([
    expect.objectContaining({ name: 'spec_review', nickname: 'Jason' }),
  ])
})

test('keeps a Subagent row without a nickname when its thread cannot be read', async () => {
  const warning = warningSpy()
  const request = (async (_method: string, params: unknown, parse: (value: unknown) => unknown) => {
    if ((params as { threadId: string }).threadId === 'thread-child') throw new Error('not found')
    return parse({ thread: { turns: [{ items: SPAWNED_ITEMS }] } })
  }) as CodexRequest
  const [content] = await readCodexSessionHistory(request, 'thread-parent')
  expect(content).toMatchObject({ name: 'spec_review' })
  expect(content).not.toHaveProperty('nickname')
  expect(warning).toHaveBeenCalledWith(
    'Could not read 1 Codex Subagent thread; it shows no nickname.',
  )
  warning.mockRestore()
})
