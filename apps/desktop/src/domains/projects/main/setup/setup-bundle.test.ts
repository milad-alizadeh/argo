import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import { loadSetupDocument, SetupDocumentLoadError } from './setup-bundle'

const document = setupDocumentFixture()

test('loads a compatible Setup document from GitHub', async () => {
  const loaded = await loadSetupDocument({
    documentURL: 'https://raw.githubusercontent.com/milad-alizadeh/argo/main/setup.json',
    request: async () => new Response(JSON.stringify(document)),
  })

  assert.equal(loaded.locales.en.title, 'Set up this Project')
})

test('reports when GitHub cannot return the Setup document', async () => {
  await assert.rejects(
    loadSetupDocument({
      documentURL: 'https://raw.githubusercontent.com/milad-alizadeh/argo/main/setup.json',
      request: async () => null,
    }),
    (error) => error instanceof SetupDocumentLoadError && error.reason === 'network-unavailable',
  )
})

test('rejects an invalid Setup document from GitHub', async () => {
  await assert.rejects(
    loadSetupDocument({
      documentURL: 'https://raw.githubusercontent.com/milad-alizadeh/argo/main/setup.json',
      request: async () => new Response(JSON.stringify({ ...document, fields: 'invalid' })),
    }),
    (error) => error instanceof SetupDocumentLoadError && error.reason === 'document-invalid',
  )
})
