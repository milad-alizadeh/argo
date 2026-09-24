import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import type { CodexRequest } from './app-server/codex-app-server-machine'
import { codexHarnessInfo, readCodexHarnessInfo, readModelCatalog } from './catalog'

const recordedResponse: unknown = JSON.parse(
  readFileSync(
    new URL('../../../mocks/cli/codex/fixtures/model-list-codex-0.147.0.json', import.meta.url),
    'utf8',
  ),
)
const catalog = codexModelCatalogFixture()

test('decodes the advertised model names and reasoning efforts', () => {
  assert.deepEqual(readModelCatalog(catalog), catalog)
})

test('normalizes Codex defaults and excludes hidden models at the Harness boundary', () => {
  const info = codexHarnessInfo(catalog)
  assert.equal(info.availability, 'available')
  if (info.availability !== 'available') throw new Error('Codex fixture should be available.')
  assert.equal(info.defaultModelId, 'gpt-live')
  assert.deepEqual(
    info.models.map(({ value }) => value),
    ['gpt-live'],
  )
  assert.equal(info.models[0]?.defaultEffort, 'focused')
})

test('rejects an unrecognized model/list response', () => {
  assert.throws(() => readModelCatalog({ data: [{ id: 'unknown-shape' }] }))
})

test('reports an unrecognized model/list response as a counted Harness failure', async () => {
  const request: CodexRequest = async (_method, _params, parse) =>
    parse({ data: [{ id: 'unknown-shape' }] })
  const info = await readCodexHarnessInfo(request)
  assert.equal(info.availability, 'unavailable')
  if (info.availability === 'unavailable') {
    assert.equal(info.reason, 'invalid-response')
    assert.match(info.detail ?? '', /model/)
  }
})

test('decodes a recorded response from codex 0.147.0', () => {
  const decoded = readModelCatalog(recordedResponse)
  assert.equal(decoded.data[0]?.model, 'gpt-5.6-sol')
  assert.equal(decoded.data[0]?.supportedReasoningEfforts[0]?.reasoningEffort, 'low')
  assert.equal(decoded.data.length, 5)
})

test('reads every model/list page before publishing Codex choices', async () => {
  const cursors: Array<string | undefined> = []
  const request: CodexRequest = async (_method, params, parse) => {
    const cursor = 'cursor' in params ? params.cursor : undefined
    cursors.push(cursor)
    const page =
      cursor === undefined
        ? { data: [catalog.data[0]], nextCursor: 'second' }
        : { data: catalog.data.slice(1), nextCursor: null }
    return parse(page)
  }
  const info = await readCodexHarnessInfo(request)
  assert.deepEqual(cursors, [undefined, 'second'])
  assert.equal(info.availability, 'available')
  if (info.availability === 'available')
    assert.deepEqual(
      info.models.map(({ value }) => value),
      ['gpt-live'],
    )
})
