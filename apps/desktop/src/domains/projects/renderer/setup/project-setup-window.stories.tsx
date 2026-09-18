import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { parseSetupDocument } from '../../contract/setup-document'
import { ProjectSetupView, ProjectSetupWindow } from './project-setup-window'

const STORY_CONFIGURATION_SOURCE = `${JSON.stringify(
  {
    version: 1,
    targets: {
      app: {
        default: true,
        path: '.',
        setup: 'bun install',
        run: 'bun run dev',
        build: 'bun run build',
      },
    },
  },
  null,
  2,
)}\n`

const STORY_SETUP_DOCUMENT = parseSetupDocument({
  version: 1,
  requiredCapabilities: ['fields', 'recommendations', 'plan', 'descriptions', 'locales'],
  revision: 'github-main',
  locales: {
    en: {
      title: 'Recommended Project setup',
      description: 'Review the plan from the Argo repository before you save it.',
      fields: {
        'target-path': { label: 'Working path' },
        'test-command': { label: 'Test command' },
      },
      plan: { 'write-settings': { label: 'Write .argo/settings.json' } },
    },
  },
  fields: [
    {
      id: 'target-path',
      type: 'text',
      required: true,
      recommendation: '.',
      configurationPath: ['targets', 'app', 'path'],
    },
    {
      id: 'test-command',
      type: 'text',
      recommendation: 'bun test',
      configurationPath: ['targets', 'app', 'test'],
    },
  ],
  configuration: JSON.parse(STORY_CONFIGURATION_SOURCE),
  plan: [{ id: 'write-settings' }],
})

const meta: Meta<typeof ProjectSetupWindow> = {
  title: 'Projects/Setup Window',
  component: ProjectSetupWindow,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ProjectSetupWindow>

export const NormalConfiguration: Story = {
  args: { project: { id: 'project-1', name: 'example', path: '/workspace/example' } },
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      beginProjectSetup: async ({ projectId }) => ({
        version: 1,
        type: 'project.setup.editing',
        requestId: 'setup-1',
        project: { id: projectId, name: 'example' },
        source: STORY_CONFIGURATION_SOURCE,
        document: STORY_SETUP_DOCUMENT,
      }),
      saveProjectSetup: async ({ projectId, source }) => ({
        version: 1,
        type: 'project.setup.editing',
        requestId: 'setup-2',
        project: { id: projectId, name: 'example' },
        source,
        document: STORY_SETUP_DOCUMENT,
      }),
      validateProjectSetup: async ({ projectId }) => ({
        version: 1,
        type: 'project.setup.validated',
        requestId: 'setup-3',
        project: { id: projectId, name: 'example' },
        valid: true,
      }),
      cancelProjectSetup: async ({ projectId }) => ({
        version: 1,
        type: 'project.setup.cancelled',
        requestId: 'setup-4',
        project: { id: projectId, name: 'example' },
      }),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('heading', { name: 'Recommended Project setup' })
    await expect(canvas.getByRole('button', { name: 'Customize plan' })).toBeVisible()
    await expect(canvas.getByText('Unsaved changes')).toBeVisible()
    const configuration = await canvas.findByLabelText('Project configuration')
    await expect(configuration).toHaveTextContent('"test": "bun test"')
    await userEvent.click(canvas.getByRole('button', { name: 'Customize plan' }))
    const path = canvas.getByRole('textbox', { name: 'Working path' })
    await userEvent.clear(path)
    await userEvent.click(canvas.getByRole('button', { name: 'Save config' }))
    await expect(path).toBeInvalid()
    await expect(
      within(document.body).queryByText('Config saved.', { selector: '[data-slot="toast-title"]' }),
    ).toBeNull()
    await userEvent.type(path, '.')
    const cancel = canvas.getByRole('button', { name: 'Cancel setup' })
    const save = canvas.getByRole('button', { name: 'Save config' })
    save.scrollIntoView()
    for (const button of [cancel, save]) {
      const bounds = button.getBoundingClientRect()
      const topElement = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      )
      await expect(button.contains(topElement)).toBe(true)
    }
    await userEvent.click(save)
    await expect(
      within(document.body).getByText('Config saved.', { selector: '[data-slot="toast-title"]' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Test config' }))
    await expect(
      within(document.body).getByText('All Project commands passed validation.', {
        selector: '[data-slot="toast-title"]',
      }),
    ).toBeVisible()
  },
}

export const SavingConfiguration: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      cancel={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      message={null}
      project={project}
      save={async () => undefined}
      saved={false}
      saving="save"
      source={STORY_CONFIGURATION_SOURCE}
      testConfiguration={async () => undefined}
      updateSource={() => undefined}
    />
  ),
}

export const CommandTestFailure: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      cancel={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      message={{ tone: 'error', text: 'A Project command failed validation.' }}
      project={project}
      save={async () => undefined}
      saved
      saving={null}
      source={STORY_CONFIGURATION_SOURCE}
      testConfiguration={async () => undefined}
      updateSource={() => undefined}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      within(document.body).getByText('A Project command failed validation.', {
        selector: '[data-slot="toast-title"]',
      }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Save config' })).toBeEnabled()
  },
}

export const SyntaxConfigurationError: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      cancel={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      message={{ tone: 'error', text: 'Fix JSON syntax before testing the config.' }}
      project={project}
      save={async () => undefined}
      saved={false}
      saving={null}
      source={'{"version": 1,'}
      testConfiguration={async () => undefined}
      updateSource={() => undefined}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      within(document.body).getByText('Fix JSON syntax before testing the config.', {
        selector: '[data-slot="toast-title"]',
      }),
    ).toBeVisible()
    await expect(canvas.getByLabelText('Project configuration')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'Save config' })).toBeDisabled()
  },
}
