import { beforeEach, expect, test, vi } from 'vitest'
import { claudeModelCatalogFixture } from '../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../test-fixtures/sessions/codex-model-catalog.fixture'
import { claudeHarnessInfo } from './claude/catalog'
import { createClaudeRegistration } from './claude/registration'
import type { CodexRequest } from './codex/app-server/codex-app-server-client'
import { codexHarnessInfo } from './codex/catalog'
import { createCodexRegistration } from './codex/registration'
import type { CodexLiveClient } from './codex/session/codex-session-channel'
import { type HarnessRegistry, readHarnessCatalog } from './registry'

const vendor = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  getSubagentMessages: vi.fn(),
  renameSession: vi.fn(),
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => vendor)

const clientFor = (request: CodexRequest): CodexLiveClient => ({
  request,
  onNotification: () => () => {},
  respond: () => {},
})

beforeEach(() => {
  vendor.getSessionMessages.mockReset()
  vendor.getSubagentMessages.mockReset()
  vendor.renameSession.mockReset()
})

test('registered Claude reads root and subagent history and renames through the SDK', async () => {
  vendor.getSessionMessages.mockResolvedValue([
    { type: 'assistant', uuid: 'reply', message: { role: 'assistant', content: 'Done' } },
  ])
  vendor.getSubagentMessages.mockResolvedValue([])
  vendor.renameSession.mockResolvedValue(undefined)
  const registrations = {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(
      clientFor(async () => {
        throw new Error('Codex was not selected.')
      }),
    ),
  } satisfies HarnessRegistry
  const claude = registrations.claude

  expect(claude.harness).toBe('claude')
  expect(claude.sessionDiscovery).toEqual(expect.any(Function))
  await expect(
    claude.readHistory({
      nativeId: 'root',
      subagentId: null,
      cwd: '/work/project',
    }),
  ).resolves.toEqual([{ kind: 'message', id: 'reply', role: 'assistant', text: 'Done' }])
  await claude.readHistory({
    nativeId: 'root',
    subagentId: 'child',
    cwd: '/work/project',
  })
  expect(vendor.getSessionMessages).toHaveBeenCalledWith('root', { dir: '/work/project' })
  expect(vendor.getSubagentMessages).toHaveBeenCalledWith('root', 'child', {
    dir: '/work/project',
  })
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
    codex: createCodexRegistration(clientFor(request)),
  } satisfies HarnessRegistry
  const codex = registrations.codex

  expect(codex.harness).toBe('codex')
  expect(codex.sessionDiscovery).toEqual(expect.any(Function))
  expect(codex.rename).toBeUndefined()
  await expect(
    codex.readHistory({
      nativeId: 'root',
      subagentId: 'child',
      cwd: null,
    }),
  ).resolves.toEqual([{ kind: 'message', id: 'reply', role: 'assistant', text: 'Done' }])
  expect(calls).toEqual([
    { method: 'thread/read', params: { threadId: 'child', includeTurns: true } },
  ])
})

test('the registry reads every Harness catalog', async () => {
  const reads = { claude: 0, codex: 0 }
  const registry = {
    claude: {
      harness: 'claude',
      readCatalog: async () => {
        reads.claude += 1
        return claudeHarnessInfo(claudeModelCatalogFixture())
      },
    },
    codex: {
      harness: 'codex',
      readCatalog: async () => {
        reads.codex += 1
        return codexHarnessInfo(codexModelCatalogFixture())
      },
    },
  } as unknown as HarnessRegistry

  const catalog = await readHarnessCatalog(registry)

  expect(reads).toEqual({ claude: 1, codex: 1 })
  expect(catalog.harnesses.map(({ availability }) => availability)).toEqual([
    'available',
    'available',
  ])
})

test('one failed catalog read leaves the other Harness available', async () => {
  const registry = {
    claude: {
      harness: 'claude',
      readCatalog: async () => claudeHarnessInfo(claudeModelCatalogFixture()),
    },
    codex: {
      harness: 'codex',
      readCatalog: async () => {
        throw new Error('Codex catalog is unavailable')
      },
    },
  } as unknown as HarnessRegistry

  const catalog = await readHarnessCatalog(registry)

  expect(catalog.harnesses[0]?.availability).toBe('available')
  expect(catalog.harnesses[1]).toEqual(codexHarnessInfo(null))
})
