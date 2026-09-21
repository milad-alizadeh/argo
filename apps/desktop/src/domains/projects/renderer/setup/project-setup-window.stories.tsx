import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ProjectSetupView } from './project-setup-window'

const project = { id: 'project-1', name: 'Example', path: '/workspace/example' }
const choosing = {
  version: 1 as const,
  type: 'project.setup.snapshot' as const,
  requestId: 'story',
  projectId: project.id,
  revision: 0,
  screen: 'choosing-method' as const,
  manualSource: '',
}

const meta: Meta<typeof ProjectSetupView> = {
  title: 'Projects/Project setup',
  component: ProjectSetupView,
  decorators: [(Story) => <div className="h-screen">{Story()}</div>],
}
export default meta
type Story = StoryObj<typeof ProjectSetupView>

export const Manual: Story = {
  args: { project, snapshot: { ...choosing, screen: 'manual' }, command: async () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Project configuration' }),
      '{"version":1}',
    )
    await expect(canvas.getByRole('button', { name: 'Save manual setup' })).toBeVisible()
  },
}

export const Deferred: Story = {
  args: {
    project,
    snapshot: { ...choosing, screen: 'deferred', revision: 2 },
    command: async () => undefined,
  },
}

export const StaleCommand: Story = {
  args: { project, snapshot: { ...choosing, screen: 'manual' }, command: async () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save manual setup' }))
  },
}

export const MultiWindow: Story = {
  args: {
    project,
    snapshot: { ...choosing, screen: 'ready', revision: 3 },
    command: async () => undefined,
  },
}
