import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { codexModelCatalogFixture } from '@/domains/sessions/contract/codex-model-catalog.test-fixture'
import { CodexModelCatalogCache, readModelCatalog } from './model-catalog'

const recordedResponse: unknown = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../mocks/cli/codex/fixtures/model-list-codex-0.147.0.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const catalog = codexModelCatalogFixture()

test('decodes the advertised model names and reasoning efforts', () => {
  assert.deepEqual(readModelCatalog(catalog), catalog)
})

test('rejects an unrecognized model/list response', () => {
  assert.throws(() => readModelCatalog({ data: [{ id: 'unknown-shape' }] }))
})

test('decodes a recorded response from codex 0.147.0', () => {
  const decoded = readModelCatalog(recordedResponse)
  assert.equal(decoded.data[0]?.model, 'gpt-5.6-sol')
  assert.equal(decoded.data[0]?.supportedReasoningEfforts[0]?.reasoningEffort, 'low')
  assert.equal(decoded.data.length, 5)
})

test('caches model/list by executable path and version', async () => {
  const cache = new CodexModelCatalogCache()
  let calls = 0
  const request = async () => {
    calls += 1
    return catalog
  }
  const key = { executablePath: '/codex', version: '1.0' }
  await cache.get(key, request)
  await cache.get(key, request)
  assert.equal(calls, 1)
  await cache.get({ ...key, version: '2.0' }, request)
  assert.equal(calls, 2)
  await cache.get({ ...key, executablePath: '/other-codex' }, request)
  assert.equal(calls, 3)
})
