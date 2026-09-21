import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import {
  ARGO_SETUP_DOCUMENT_URL,
  loadSetupDocument,
  SetupDocumentLoadError,
  setupDocumentRequest,
  setupDocumentURL,
} from './setup-bundle'

const document = setupDocumentFixture()

test('loads the Setup document from the current GitHub branch during development', () => {
  const environmentName = 'ARGO_SETUP_DOCUMENT_DEVELOPMENT_URL'
  const previous = process.env[environmentName]
  const developmentURL =
    'https://raw.githubusercontent.com/milad-alizadeh/argo/argo/%232392-guided-plan/packages/argo-skills/setup/project-setup.json'
  process.env[environmentName] = developmentURL
  try {
    assert.equal(setupDocumentURL('production'), ARGO_SETUP_DOCUMENT_URL)
    assert.equal(setupDocumentURL('development'), developmentURL)
  } finally {
    if (previous === undefined) delete process.env[environmentName]
    else process.env[environmentName] = previous
  }
})

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

test('uses the published document when an unpublished development branch is unavailable', async () => {
  const requested: string[] = []
  const request = setupDocumentRequest('development', async (url) => {
    requested.push(url)
    return new Response(JSON.stringify(document), { status: requested.length === 1 ? 404 : 200 })
  })

  const loaded = await loadSetupDocument({
    documentURL:
      'https://raw.githubusercontent.com/milad-alizadeh/argo/argo/%232381/project-setup.json',
    request,
  })

  assert.equal(loaded.revision, document.revision)
  assert.deepEqual(requested, [
    'https://raw.githubusercontent.com/milad-alizadeh/argo/argo/%232381/project-setup.json',
    ARGO_SETUP_DOCUMENT_URL,
  ])
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
