import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { parseSetupDocument } from '../../contract/setup-document'
import { ProjectSetupView, ProjectSetupWindow } from './project-setup-window'

const STORY_CONFIGURATION_SOURCE = `${JSON.stringify(
  {
    version: 1,
    targets: {
      desktop: {
        default: true,
        path: 'apps/desktop',
        setup: 'bun install',
        run: 'bun run dev',
        build: 'bun run build',
        test: 'bun run test',
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
        'target-path': {
          label: 'Project target',
          description: 'Argo runs Project commands from this folder.',
        },
        'package-manager': {
          label: 'Package manager',
          description: 'Used for generated commands and setup.',
          choices: { bun: 'Bun', pnpm: 'pnpm', npm: 'npm' },
        },
        'component-explorer': {
          label: 'Use Storybook',
          description: 'Keep Storybook as the place to review components and states.',
        },
        'browser-tests': {
          label: 'Add Playwright journeys',
          description: 'Add browser journeys for the most important user flows.',
        },
        'setup-command': { label: 'Setup command' },
        'run-command': { label: 'Run command' },
        'test-command': { label: 'Test command' },
      },
      plan: {
        project: {
          label: 'Project',
          description: 'Choose where Argo runs and which package manager it uses.',
        },
        tools: {
          label: 'Tools',
          description: 'Choose the development tools Argo should prepare.',
        },
        commands: {
          label: 'Commands',
          description: 'Review the commands Argo will run for this Project.',
        },
      },
    },
  },
  fields: [
    {
      id: 'target-path',
      type: 'text',
      required: true,
      recommendation: 'apps/desktop',
      configurationPath: ['targets', 'desktop', 'path'],
    },
    {
      id: 'package-manager',
      type: 'choice',
      choices: [{ value: 'bun' }, { value: 'pnpm' }, { value: 'npm' }],
      recommendation: 'bun',
      configurationPath: ['targets', 'desktop', 'packageManager'],
    },
    {
      id: 'component-explorer',
      type: 'boolean',
      recommendation: true,
      configurationPath: ['targets', 'desktop', 'componentExplorer'],
    },
    {
      id: 'browser-tests',
      type: 'boolean',
      recommendation: false,
      configurationPath: ['targets', 'desktop', 'browserTests'],
    },
    {
      id: 'setup-command',
      type: 'text',
      recommendation: 'bun install',
      configurationPath: ['targets', 'desktop', 'setup'],
    },
    {
      id: 'run-command',
      type: 'text',
      recommendation: 'bun run dev',
      configurationPath: ['targets', 'desktop', 'run'],
    },
    {
      id: 'test-command',
      type: 'text',
      recommendation: 'bun run test',
      configurationPath: ['targets', 'desktop', 'test'],
    },
  ],
  configuration: JSON.parse(STORY_CONFIGURATION_SOURCE),
  plan: [
    { id: 'project', icon: 'folder', fieldIds: ['target-path', 'package-manager'] },
    { id: 'tools', icon: 'wrench', fieldIds: ['component-explorer', 'browser-tests'] },
    {
      id: 'commands',
      icon: 'terminal',
      fieldIds: ['setup-command', 'run-command', 'test-command'],
    },
  ],
})

const meta: Meta<typeof ProjectSetupWindow> = {
  title: 'Projects/Setup Window',
  component: ProjectSetupWindow,
  decorators: [(Story) => <div className="h-screen">{Story()}</div>],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ProjectSetupWindow>

export const NormalConfiguration: Story = {
  args: { project: { id: 'project-1', name: 'example', path: '/workspace/example' } },
  globals: { theme: 'light' },
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
}

export const DarkConfiguration: Story = {
  ...NormalConfiguration,
  globals: { theme: 'dark' },
}

export const CompleteSetupJourney: Story = {
  ...NormalConfiguration,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('heading', { name: 'Ready this Project for agents' })
    await expect(canvas.getByText('Recommended plan')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Customize plan' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Import config' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(canvas.queryByLabelText('Project configuration')).toBeNull()
    await expect(canvas.queryByText('Save config')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Customize plan' }))
    await expect(
      canvas.getByRole('heading', { name: 'Adjust the recommended setup' }),
    ).toBeVisible()
    const path = canvas.getByRole('textbox', { name: 'Project target' })
    await userEvent.clear(path)
    await userEvent.click(canvas.getByRole('button', { name: 'Apply setup' }))
    await expect(path).toBeInvalid()
    await expect(
      within(document.body).queryByText('Config saved.', { selector: '[data-slot="toast-title"]' }),
    ).toBeNull()
    await userEvent.type(path, '.')
    await userEvent.click(canvas.getByRole('button', { name: 'Test setup' }))
    await expect(
      within(document.body).getByText('All Project commands passed validation.', {
        selector: '[data-slot="toast-title"]',
      }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Import config' }))
    await expect(canvas.getByRole('heading', { name: 'Import .argo/settings.json' })).toBeVisible()
    await expect(canvas.getByLabelText('Project configuration')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Test configuration' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Import config' }))
    await expect(
      within(document.body).getByText('Config saved.', { selector: '[data-slot="toast-title"]' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(
      canvas.getByRole('heading', { name: 'Ready this Project for agents' }),
    ).toBeVisible()
  },
}

export const LoadingPlan: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      applyConfiguration={async () => undefined}
      document={null}
      loading
      message={null}
      project={project}
      retry={() => undefined}
      saving={null}
      source=""
      testConfiguration={async () => undefined}
      updateSource={() => undefined}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Retrieving the setup skill and generating a plan…'),
    ).toBeVisible()
    await expect(canvas.getByRole('status')).toHaveClass('project-setup-shimmer')
  },
}

export const SavingConfiguration: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      applyConfiguration={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      loading={false}
      message={null}
      project={project}
      retry={() => undefined}
      saving="apply"
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
      applyConfiguration={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      loading={false}
      message={{ tone: 'error', text: 'A Project command failed validation.' }}
      project={project}
      retry={() => undefined}
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
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled()
  },
}

export const SyntaxConfigurationError: Story = {
  args: NormalConfiguration.args,
  render: ({ project }) => (
    <ProjectSetupView
      applyConfiguration={async () => undefined}
      document={STORY_SETUP_DOCUMENT}
      loading={false}
      message={{ tone: 'error', text: 'Fix JSON syntax before testing the config.' }}
      project={project}
      retry={() => undefined}
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
    await userEvent.click(canvas.getByRole('button', { name: 'Import config' }))
    await expect(canvas.getByLabelText('Project configuration')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'Import config' })).toBeDisabled()
  },
}
