import { fileURLToPath } from 'node:url'
import { afterEach, expect, test, vi } from 'vitest'
import { scanRollouts } from '../../../../mocks/cli/codex/mock-codex-rollout-history.ts'
import type { CodexRequest } from '../app-server/codex-app-server-machine'
import { readCodexSessionHistory } from './codex-session-history'

afterEach(() => vi.unstubAllEnvs())

test('projects recorded Codex user and agent messages into Feed prose', async () => {
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
    { shape: 'prose', id: 'codex-child-u1', role: 'user', text: 'Continue the check' },
    { shape: 'prose', id: 'codex-child-a1', role: 'assistant', text: 'Continuing' },
  ])
  expect(calls).toEqual([
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
