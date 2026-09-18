import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { parseSetupDocument } from '../../contract/setup-document'
import { SetupDocumentForm } from './setup-document-form'

const document = parseSetupDocument({
  version: 1,
  requiredCapabilities: [
    'fields',
    'recommendations',
    'plan',
    'descriptions',
    'locales',
    'progress',
    'revisions',
  ],
  revision: 'revision-1',
  locales: {
    en: {
      title: 'Set up this Project',
      description: 'Review the recommended plan.',
      fields: {
        'target.path': { label: 'Working path' },
        'test.runner': {
          label: 'Test runner',
          choices: { bun: 'Bun', vitest: 'Vitest' },
        },
        'component-explorer': { label: 'Add a Component explorer' },
      },
      plan: {
        'write-settings': {
          label: 'Write Project configuration',
          description: 'Argo writes the approved target and commands.',
        },
      },
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
      id: 'component-explorer',
      type: 'boolean',
      recommendation: true,
      configurationPath: ['targets', 'app', 'componentExplorer'],
    },
  ],
  configuration: {
    version: 1,
    targets: { app: { default: true, path: '.', test: 'bun', componentExplorer: true } },
  },
  plan: [{ id: 'write-settings' }],
  progress: { current: 1, total: 3 },
})

const meta: Meta<typeof SetupDocumentForm> = {
  title: 'Projects/Setup Document Form',
  component: SetupDocumentForm,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SetupDocumentForm>

export const RecommendedPlan: Story = {
  args: {
    configurationSource: JSON.stringify(document.configuration),
    document,
    language: 'en',
    onAnswersChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Customize plan' })).toBeVisible()
    await expect(canvas.queryByRole('textbox', { name: 'Working path' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Customize plan' }))
    await expect(canvas.getByRole('textbox', { name: 'Working path' })).toHaveValue('.')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Test runner' }), 'vitest')
    await expect(canvas.getByRole('combobox', { name: 'Test runner' })).toHaveValue('vitest')
    await expect(canvas.getByRole('checkbox', { name: 'Add a Component explorer' })).toBeChecked()
  },
}
