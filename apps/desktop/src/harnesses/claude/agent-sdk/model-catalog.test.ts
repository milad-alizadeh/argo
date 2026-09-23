import { expect, test } from 'bun:test'
import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk'
import { claudeModelCatalogFixture } from '../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { ClaudeModelCatalogCache, permissionModesFromHelp } from './model-catalog'

test('reads permission modes from the installed Claude CLI help', () => {
  expect(
    permissionModesFromHelp(
      '  --permission-mode <mode> Permission mode to use for the session (choices: "acceptEdits", "auto", "manual")\n  --permission-prompts <target>',
    ),
  ).toEqual(['acceptEdits', 'auto', 'manual'])
})

test('keeps a new permission mode advertised by Claude CLI help', () => {
  expect(
    permissionModesFromHelp(
      '  --permission-mode <mode> Permission mode (choices: "workspaceAudit")\n  --permission-prompts <target>',
    ),
  ).toEqual(['workspaceAudit'])
})

test('reports no permission modes when Claude CLI help does not advertise them', () => {
  expect(permissionModesFromHelp('Usage: claude [options]')).toEqual([])
})

test('caches the catalog by executable path and version', async () => {
  const cache = new ClaudeModelCatalogCache()
  let queries = 0
  const query = async () => {
    queries += 1
    const model = claudeModelCatalogFixture().data[0]
    if (model === undefined) throw new Error('Claude catalog fixture has no models.')
    return {
      models: [{ ...model, supportedEffortLevels: ['low', 'high'] } satisfies ModelInfo],
      permissionModes: ['manual'],
    }
  }
  const first = { executablePath: '/claude-a', version: '2.1.1' }
  await cache.get(first, query)
  await cache.get(first, query)
  await cache.get({ ...first, executablePath: '/claude-b' }, query)
  await cache.get({ ...first, version: '2.1.2' }, query)
  expect(queries).toBe(3)
})
