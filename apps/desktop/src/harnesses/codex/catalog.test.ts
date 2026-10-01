import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recordedCodexModels as recordedResponse } from '@/mocks/recordings/codex-app-server'
import { codexModelCatalogFixture } from '@/mocks/recordings/codex-model-catalog'
import type { CodexRequest } from './app-server/codex-app-server-client'
import { codexHarnessInfo, readCodexHarnessInfo, readModelCatalog } from './catalog'

const catalog = codexModelCatalogFixture()

test('decodes the advertised model names and reasoning efforts', () => {
  assert.deepEqual(readModelCatalog(catalog), catalog)
})

test('normalizes Codex defaults and excludes hidden models at the Harness boundary', () => {
  const info = codexHarnessInfo(catalog)
  assert.equal(info.availability, 'available')
  if (info.availability !== 'available') throw new Error('Codex fixture should be available.')
  assert.equal(info.defaultModelId, 'gpt-6-astra')
  assert.deepEqual(
    info.models.map(({ value }) => value),
    [
      'gpt-6-astra',
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
    ],
  )
  assert.equal(info.models[0]?.defaultEffort, 'medium')
})

test('names a Codex reasoning effort in the words every Harness uses', () => {
  const modelCatalog = {
    ...catalog,
    data: catalog.data.map((model) => ({
      ...model,
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: [
        { reasoningEffort: 'medium', description: 'Balances speed and reasoning' },
      ],
    })),
  }
  const info = codexHarnessInfo(modelCatalog)
  assert.equal(info.availability, 'available')
  if (info.availability !== 'available') throw new Error('Codex fixture should be available.')
  assert.equal(info.efforts[0]?.label, 'Medium')
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

test('decodes the current recorded Codex model response', () => {
  const decoded = readModelCatalog(recordedResponse)
  assert.equal(decoded.data[0]?.model, 'gpt-6-astra')
  assert.equal(decoded.data[0]?.supportedReasoningEfforts[0]?.reasoningEffort, 'low')
  assert.equal(decoded.data.length, 9)
})

test('reads every model/list page before publishing Codex choices', async () => {
  const cursors: Array<string | undefined> = []
  const request: CodexRequest = async (_method, params, parse) => {
    const cursor = 'cursor' in params ? params.cursor : undefined
    cursors.push(cursor ?? undefined)
    const page =
      cursor === undefined
        ? { data: [catalog.data[0]], nextCursor: 'second' }
        : { data: catalog.data.slice(1, 2), nextCursor: null }
    return parse(page)
  }
  const info = await readCodexHarnessInfo(request)
  assert.deepEqual(cursors, [undefined, 'second'])
  assert.equal(info.availability, 'available')
  if (info.availability === 'available')
    assert.deepEqual(
      info.models.map(({ value }) => value),
      ['gpt-6-astra', 'gpt-6-sol'],
    )
})
