import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EmptyProjectWindow } from './empty-project-window'

const meta = {
  title: 'Projects/Empty Project Window',
  component: EmptyProjectWindow,
  args: { busy: false, onAdd: fn() },
} satisfies Meta<typeof EmptyProjectWindow>

export default meta
type Story = StoryObj<typeof EmptyProjectWindow>

export const NoProject: Story = {
  play: async ({ args, canvasElement }) => {
    const screen = within(canvasElement).getByRole('main', { name: 'No Project' })
    await expect(within(screen).getByText('Add a Project to start')).toBeInTheDocument()
    await expect(
      within(screen).getByText('Argo shows the Sessions, Tickets and Atlas of one Project.', {
        exact: false,
      }),
    ).toBeInTheDocument()
    const add = within(screen).getByRole('button', { name: 'Add Project…' })
    await expect(add).toBeEnabled()
    await userEvent.click(add)
    await expect(args.onAdd).toHaveBeenCalled()
  },
}

export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement).getByRole('main', { name: 'No Project' })
    await expect(within(screen).getByRole('button', { name: 'Add Project…' })).toBeDisabled()
  },
}
