import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { parseSetupDocument } from '../model/setup-document'
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

const meta = {
  title: 'Features/Projects/Onboarding/Document Form',
  component: SetupDocumentForm,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SetupDocumentForm>

export default meta
type Story = StoryObj<typeof SetupDocumentForm>

export const RecommendedPlan: Story = {
  args: {
    applyConfiguration: fn(),
    configurationSource: JSON.stringify(document.configuration),
    document,
    language: 'en',
    onConfigurationChange: fn(),
    saving: null,
    testConfiguration: fn(),
  },
  render: (args) => <ControlledSetupDocumentForm {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Customize plan' })).toBeVisible()
    await expect(canvas.queryByRole('textbox', { name: 'Working path' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Customize plan' }))
    await expect(canvas.getByRole('textbox', { name: 'Working path' })).toHaveValue('.')
    const testRunner = canvas.getByRole('combobox', { name: 'Test runner' })
    await userEvent.click(testRunner)
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('option', { name: 'Vitest' }),
    )
    await expect(testRunner).toHaveTextContent('Vitest')
    const explorer = canvas.getByRole('checkbox', { name: 'Add a Component explorer' })
    await expect(explorer).toBeChecked()
    const explorerCard = explorer.parentElement
    const explorerLabel = explorerCard?.querySelector<HTMLLabelElement>('label')
    if (!explorerCard || !explorerLabel)
      throw new Error('Component explorer choice label is missing')
    const cardBounds = explorerCard.getBoundingClientRect()
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: explorerLabel,
      coords: { clientX: cardBounds.left + 4, clientY: cardBounds.top + 4 },
    })
    await expect(explorer).not.toBeChecked()
    const checkboxBounds = explorer.getBoundingClientRect()
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: explorer,
      coords: {
        clientX: checkboxBounds.left + checkboxBounds.width / 2,
        clientY: checkboxBounds.top + checkboxBounds.height / 2,
      },
    })
    await expect(explorer).toBeChecked()
    explorer.focus()
    await userEvent.keyboard(' ')
    await expect(explorer).not.toBeChecked()
  },
}

function ControlledSetupDocumentForm(props: ComponentProps<typeof SetupDocumentForm>) {
  const [source, setSource] = useState(props.configurationSource)
  return (
    <SetupDocumentForm
      {...props}
      configurationSource={source}
      onConfigurationChange={(nextSource) => {
        props.onConfigurationChange(nextSource)
        setSource(nextSource)
      }}
    />
  )
}
