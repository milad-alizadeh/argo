import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import { setupAnswers, setupConfiguration } from './setup-document'
import { parseSetupDocument } from './setup-document'

const document = setupDocumentFixture({
  locales: {
    en: {
      title: 'Set up this Project',
      description: 'Review the recommended plan before Argo applies it.',
      fields: {
        'target.path': { label: 'Working path' },
        'test.runner': {
          label: 'Test runner',
          choices: { bun: 'Bun', vitest: 'Vitest' },
        },
        enabled: { label: 'Enabled' },
      },
      plan: { 'write-settings': { label: 'Write Project configuration' } },
    },
  },
  fields: [
    {
      id: 'target.path',
      type: 'text',
      required: true,
      recommendation: '.',
      configurationPath: ['targets', 'app', 'path'],
    },
    {
      id: 'test.runner',
      type: 'choice',
      choices: [{ value: 'bun' }, { value: 'vitest' }],
      recommendation: 'bun',
      configurationPath: ['targets', 'app', 'test'],
    },
    {
      id: 'enabled',
      type: 'boolean',
      recommendation: false,
      configurationPath: ['targets', 'app', 'enabled'],
    },
  ],
  configuration: {
    version: 1,
    targets: { app: { default: true, path: '.', test: 'bun', enabled: false } },
  },
  plan: [{ id: 'write-settings' }],
  ignoredByThisAppVersion: 'optional content',
})
const choiceField = parseSetupDocument(document).fields[1]
assert.ok(choiceField)

test('accepts a supported Setup document and preserves its declarative fields', () => {
  const parsed = parseSetupDocument(document)
  assert.equal(parsed.locales.en?.title, 'Set up this Project')
  assert.equal(parsed.fields[1]?.type, 'choice')
  assert.equal(parsed.fields[1]?.recommendation, 'bun')
})

test('ignores unknown optional properties at every document level', () => {
  const parsed = parseSetupDocument({
    ...document,
    fields: [{ ...choiceField, ignoredChoiceProperty: true }],
    progress: { current: 1, total: 2, ignoredProgressProperty: true },
  })
  assert.equal('ignoredByThisAppVersion' in parsed, false)
  const field = parsed.fields[0]
  assert.ok(field)
  assert.equal('ignoredChoiceProperty' in field, false)
  assert.ok(parsed.progress)
  assert.equal('ignoredProgressProperty' in parsed.progress, false)
})

test('rejects a Setup document with an unknown required capability', () => {
  assert.throws(
    () => parseSetupDocument({ ...document, requiredCapabilities: ['unreleased-control'] }),
    /requires an app update/,
  )
})

test('rejects a choice recommendation that is not one of its declared values', () => {
  assert.throws(
    () =>
      parseSetupDocument({
        ...document,
        fields: [{ ...choiceField, recommendation: 'jest' }],
      }),
    /recommendation/,
  )
})

test('builds the Project configuration from guided answers', () => {
  const parsed = parseSetupDocument(document)
  const configuration = setupConfiguration(parsed, {
    'target.path': 'apps/desktop',
    'test.runner': 'vitest',
    enabled: true,
  })

  assert.deepEqual(JSON.parse(configuration), {
    version: 1,
    targets: { app: { default: true, path: 'apps/desktop', test: 'vitest', enabled: true } },
  })
})

test('restores guided answers from saved Project configuration', () => {
  const parsed = parseSetupDocument(document)
  const answers = setupAnswers(
    parsed,
    JSON.stringify({
      version: 1,
      targets: {
        app: { default: true, path: 'packages/argo-skills', test: 'vitest', enabled: false },
      },
    }),
  )

  assert.deepEqual(answers, {
    'target.path': 'packages/argo-skills',
    'test.runner': 'vitest',
    enabled: false,
  })
})

test('falls back when saved answers do not match their declared field types', () => {
  const parsed = parseSetupDocument(document)
  const answers = setupAnswers(
    parsed,
    JSON.stringify({
      version: 1,
      targets: { app: { path: '.', test: 'unknown', enabled: 'false' } },
    }),
  )

  assert.equal(answers['test.runner'], 'bun')
  assert.equal(answers.enabled, false)
})
