import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from './setup-document'

const document = setupDocumentFixture({
  requiredCapabilities: ['fields', 'recommendations', 'plan', 'plan-sections'],
  locales: {
    en: {
      title: 'Set up this Project',
      description: 'Review the recommended plan before Argo applies it.',
      fields: { target: { label: 'Project target' } },
      plan: { project: { label: 'Project' } },
    },
  },
  fields: [
    {
      id: 'target',
      type: 'text',
      recommendation: '.',
      configurationPath: ['targets', 'app', 'path'],
    },
  ],
  plan: [{ id: 'project', icon: 'folder', fieldIds: ['target'] }],
})

test('preserves the declarative sections that group setup fields', () => {
  const parsed = parseSetupDocument(document)
  assert.deepEqual(parsed.plan, [{ id: 'project', icon: 'folder', fieldIds: ['target'] }])
})

test('rejects a setup section that names an unknown field', () => {
  assert.throws(
    () =>
      parseSetupDocument({
        ...document,
        plan: [{ id: 'project', icon: 'folder', fieldIds: ['missing'] }],
      }),
    /unknown field/,
  )
})
