import { readFileSync } from 'node:fs'
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

test('ignores known non-message items and rejects unrecognized item types', async () => {
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({
      thread: {
        turns: [{ items: [{ id: 'compaction', type: 'contextCompaction' }] }],
      },
    })) as CodexRequest
  await expect(readCodexSessionHistory(request, 'thread')).resolves.toEqual([])

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

test('reads each recorded Subagent as one delegation, updated by its activity', async () => {
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
  const delegation = (status: 'running' | 'completed' | 'interrupted') => ({
    kind: 'delegation',
    id: 'thread-child-review',
    agentId: 'thread-child-review',
    status,
    name: 'spec_review',
    prompt: null,
    model: null,
    summary: null,
  })
  await expect(readCodexSessionHistory(request, 'thread-parent')).resolves.toEqual([
    { kind: 'message', id: 'user-1', role: 'user', text: 'Review the branch' },
    delegation('running'),
    delegation('completed'),
    delegation('running'),
    delegation('interrupted'),
    { kind: 'message', id: 'agent-1', role: 'assistant', text: 'The review is in.' },
  ])
})
