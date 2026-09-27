import { beforeEach, expect, test, vi } from 'vitest'
import { createClaudeRegistration } from './claude/registration'
import type { CodexRequest } from './codex/app-server/codex-app-server-client'
import { createCodexRegistration } from './codex/registration'
import type { HarnessRegistry } from './registry'

const vendor = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  renameSession: vi.fn(),
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => vendor)

beforeEach(() => {
  vendor.getSessionMessages.mockReset()
  vendor.renameSession.mockReset()
})

test('registered Claude reads root and subagent history and renames through the SDK', async () => {
  vendor.getSessionMessages.mockResolvedValue([
    { type: 'assistant', uuid: 'reply', message: { content: 'Done' } },
  ])
  vendor.renameSession.mockResolvedValue(undefined)
  const registrations = {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(async () => {
      throw new Error('Codex was not selected.')
    }),
  } satisfies HarnessRegistry
  const claude = registrations.claude

  expect(claude.harness).toBe('claude')
  await expect(
    claude.readHistory({
      nativeId: 'root',
      subagentId: null,
      cwd: '/work/project',
    }),
  ).resolves.toEqual([{ shape: 'prose', id: 'reply', role: 'assistant', text: 'Done' }])
  await claude.readHistory({
    nativeId: 'root',
    subagentId: 'child',
    cwd: '/work/project',
  })
  expect(vendor.getSessionMessages).toHaveBeenNthCalledWith(1, 'root', { dir: '/work/project' })
  expect(vendor.getSessionMessages).toHaveBeenNthCalledWith(2, 'child', { dir: '/work/project' })
  await claude.rename?.('root', 'New title')
  expect(vendor.renameSession).toHaveBeenCalledWith('root', 'New title')
})

test('registered Codex reads the selected thread through its shared request and has no rename', async () => {
  const calls: unknown[] = []
  const request = (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    return parse({
      thread: { turns: [{ items: [{ id: 'reply', type: 'agentMessage', text: 'Done' }] }] },
    })
  }) as CodexRequest
  const registrations = {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(request),
  } satisfies HarnessRegistry
  const codex = registrations.codex

  expect(codex.harness).toBe('codex')
  expect(codex.rename).toBeUndefined()
  await expect(
    codex.readHistory({
      nativeId: 'root',
      subagentId: 'child',
      cwd: null,
    }),
  ).resolves.toEqual([{ shape: 'prose', id: 'reply', role: 'assistant', text: 'Done' }])
  expect(calls).toEqual([
    { method: 'thread/read', params: { threadId: 'child', includeTurns: true } },
  ])
})
