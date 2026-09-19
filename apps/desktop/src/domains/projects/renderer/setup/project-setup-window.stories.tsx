import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import {
  ProjectSetupView,
  ProjectSetupWindow,
} from '@/domains/projects/renderer/setup/project-setup-window'

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
        test: 'bun test',
      },
    },
  },
  null,
  2,
)}\n`

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
        saved: false,
      }),
      saveProjectSetup: async ({ projectId, source }) => ({
        version: 1,
        type: 'project.setup.editing',
        requestId: 'setup-2',
        project: { id: projectId, name: 'example' },
        source,
        saved: true,
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
    await canvas.findByLabelText('Project configuration')
    await userEvent.click(canvas.getByRole('button', { name: 'Save config' }))
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
