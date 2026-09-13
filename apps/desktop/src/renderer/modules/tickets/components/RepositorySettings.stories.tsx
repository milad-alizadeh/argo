import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { RepositorySettings } from './RepositorySettings'

const meta: Meta<typeof RepositorySettings> = {
  title: 'Tickets/Repository Settings',
  component: RepositorySettings,
  decorators: [
    (Story) => (
      <div className="max-w-md p-(--spacing-shell-inset)">
        <Story />
      </div>
    ),
  ],
  args: { disconnecting: false, error: null, onConnect: fn(), onDisconnect: fn() },
}

export default meta
type Story = StoryObj<typeof RepositorySettings>

export const Connected: Story = {
  args: {
    connection: {
      accountId: 'github:583231',
      login: 'octocat',
      scope: 'octocat/hello-world',
      state: 'ready',
    },
  },
  play: async ({ args, canvasElement }) => {
    const section = within(canvasElement).getByRole('region', { name: 'Repository' })
    await expect(section).toHaveTextContent('octocat/hello-world')
    await expect(section).toHaveTextContent('Read through octocatConnected')
    await userEvent.click(within(section).getByRole('button', { name: 'Disconnect repository' }))
    await expect(args.onDisconnect).toHaveBeenCalled()
  },
}

export const NotConnected: Story = {
  args: { connection: null },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No repository connected')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a repository' }))
    await expect(args.onConnect).toHaveBeenCalled()
  },
}
