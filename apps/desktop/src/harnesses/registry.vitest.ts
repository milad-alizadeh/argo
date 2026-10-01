import { beforeEach, expect, test, vi } from 'vitest'
import { claudeModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '@/mocks/sessions/codex-model-catalog.fixture'
import { ACP_HARNESSES, byAcpAgent } from './acp/acp-agents'
import { createAcpRegistrations } from './acp/acp-registration-factory'
import { claudeHarnessInfo } from './claude/catalog'
import { createClaudeRegistration } from './claude/registration'
import type { CodexAppServerClient, CodexRequest } from './codex/app-server/codex-app-server-client'
import { codexHarnessInfo } from './codex/catalog'
import { createCodexRegistration } from './codex/registration'
import { HARNESSES, type Harness } from './harness'
import { unavailable } from './harness-catalog'
import { type HarnessRegistry, readHarnessCatalog } from './registry'

const vendor = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  getSubagentMessages: vi.fn(),
  renameSession: vi.fn(),
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => vendor)

const clientFor = (request: CodexRequest): CodexAppServerClient => ({
  request,
  onNotification: () => () => {},
  respond: () => {},
  shutdown: () => {},
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
    ...createAcpRegistrations(),
  } satisfies HarnessRegistry
  const claude = registrations.claude

  expect(claude.harness).toBe('claude')
  expect(claude.listSessionSummaries).toEqual(expect.any(Function))
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
    ...createAcpRegistrations(),
  } satisfies HarnessRegistry
  const codex = registrations.codex

  expect(codex.harness).toBe('codex')
  expect(codex.listSessionSummaries).toEqual(expect.any(Function))
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
  const reads: Partial<Record<Harness, number>> = {}
  const read = (harness: Harness) => {
    reads[harness] = (reads[harness] ?? 0) + 1
  }
  const registry = {
    claude: {
      harness: 'claude',
      readCatalog: async () => {
        read('claude')
        return claudeHarnessInfo(claudeModelCatalogFixture())
      },
    },
    codex: {
      harness: 'codex',
      readCatalog: async () => {
        read('codex')
        return codexHarnessInfo(codexModelCatalogFixture())
      },
    },
    ...byAcpAgent(({ id }) => ({
      harness: id,
      readCatalog: async () => {
        read(id)
        return unavailable(id)
      },
    })),
  } as unknown as HarnessRegistry

  const catalog = await readHarnessCatalog(registry)

  expect(reads).toEqual(Object.fromEntries(HARNESSES.map((harness) => [harness, 1])))
  expect(catalog.harnesses.map(({ availability }) => availability)).toEqual([
    'available',
    'available',
    ...ACP_HARNESSES.map(() => 'unavailable'),
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
    ...byAcpAgent(({ id }) => ({ harness: id, readCatalog: async () => unavailable(id) })),
  } as unknown as HarnessRegistry

  const catalog = await readHarnessCatalog(registry)

  expect(catalog.harnesses[0]?.availability).toBe('available')
  expect(catalog.harnesses[1]).toEqual(codexHarnessInfo(null))
})
