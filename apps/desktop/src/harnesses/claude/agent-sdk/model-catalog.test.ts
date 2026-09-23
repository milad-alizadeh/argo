import { expect, test } from 'bun:test'
import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk'
import { claudeModelCatalogFixture } from '../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { ClaudeModelCatalogCache } from './model-catalog'

test('caches the catalog by executable path and version', async () => {
  const cache = new ClaudeModelCatalogCache()
  let queries = 0
  const query = async (): Promise<readonly ModelInfo[]> => {
    queries += 1
    const model = claudeModelCatalogFixture().data[0]
    if (model === undefined) throw new Error('Claude catalog fixture has no models.')
    return [
      {
        ...model,
        supportedEffortLevels: ['low', 'high'],
      },
    ]
  }
  const first = { executablePath: '/claude-a', version: '2.1.1' }
  await cache.get(first, query)
  await cache.get(first, query)
  await cache.get({ ...first, executablePath: '/claude-b' }, query)
  await cache.get({ ...first, version: '2.1.2' }, query)
  expect(queries).toBe(3)
})
