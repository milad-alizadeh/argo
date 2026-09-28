import { fileURLToPath } from 'node:url'
import { afterEach, expect, test, vi } from 'vitest'
import { scanRollouts } from '../../../../mocks/cli/codex/mock-codex-rollout-history.ts'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { hasCodexSessionTurn, readCodexSessionHistory } from './codex-session-history'

afterEach(() => vi.unstubAllEnvs())

test('projects recorded Codex user and agent messages into Feed content', async () => {
  vi.stubEnv(
    'ARGO_CODEX_TRANSCRIPTS',
    fileURLToPath(new URL('../../../../mocks/cli/codex/fixtures/sessions', import.meta.url)),
  )
  const thread = scanRollouts().find((candidate) => candidate.id === 'rollout-codexChild')
  if (thread === undefined) throw new Error('The recorded Codex thread is missing.')
  const calls: unknown[] = []
  const request = (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    return parse({ thread })
  }) as CodexRequest

  await expect(readCodexSessionHistory(request, thread.id)).resolves.toEqual([
    { kind: 'message', id: 'codex-child-u1', role: 'user', text: 'Continue the check' },
    { kind: 'message', id: 'codex-child-a1', role: 'assistant', text: 'Continuing' },
  ])
  const recordedTurnId = thread.turns[0]?.id
  if (recordedTurnId === undefined) throw new Error('The recorded Codex turn is missing.')
  await expect(hasCodexSessionTurn(request, thread.id, recordedTurnId)).resolves.toBe(true)
  await expect(hasCodexSessionTurn(request, thread.id, 'missing-turn')).resolves.toBe(false)
  expect(calls).toEqual([
    { method: 'thread/read', params: { threadId: 'rollout-codexChild', includeTurns: true } },
    { method: 'thread/read', params: { threadId: 'rollout-codexChild', includeTurns: true } },
    { method: 'thread/read', params: { threadId: 'rollout-codexChild', includeTurns: true } },
  ])
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
                changes: [{ path: '/repo/feed.ts', diff: '+updated', kind: { type: 'update' } }],
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
    { kind: 'fileChange', id: 'edit-1', changes: [{ path: '/repo/feed.ts', change: 'update' }] },
    { kind: 'tool', id: 'mcp-1', output: [{ kind: 'text', text: 'updated' }] },
    { kind: 'message', id: 'answer-1', phase: 'final_answer' },
  ])
})
