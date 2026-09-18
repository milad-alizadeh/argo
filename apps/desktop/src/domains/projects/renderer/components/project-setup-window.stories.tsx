import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ProjectSetupWindow } from './project-setup-window'

const meta: Meta<typeof ProjectSetupWindow> = {
  title: 'Projects/Setup Window',
  component: ProjectSetupWindow,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ProjectSetupWindow>

export const ManualConfiguration: Story = {
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
        source: 'version = 1\n',
      }),
      saveProjectSetup: async ({ projectId, source }) => ({
        version: 1,
        type: 'project.setup.editing',
        requestId: 'setup-2',
        project: { id: projectId, name: 'example' },
        source,
      }),
      validateProjectSetup: async ({ projectId }) => ({
        version: 1,
        type: 'project.setup.validated',
        requestId: 'setup-3',
        project: { id: projectId, name: 'example' },
        valid: true,
      }),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const source = await canvas.findByLabelText('Project configuration')
    await userEvent.clear(source)
    await userEvent.type(source, 'version = 1')
    await userEvent.click(canvas.getByRole('button', { name: 'Save configuration' }))
    await expect(canvas.getByText('Configuration saved in the setup worktree.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Validate configuration' }))
    await expect(canvas.getByText('All Project commands passed validation.')).toBeVisible()
  },
}
