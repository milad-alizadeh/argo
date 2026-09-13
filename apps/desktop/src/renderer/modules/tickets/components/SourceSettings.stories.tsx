import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SourceSettings } from './SourceSettings'

const meta: Meta<typeof SourceSettings> = {
  title: 'Tickets/Source Settings',
  component: SourceSettings,
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
type Story = StoryObj<typeof SourceSettings>

export const Connected: Story = {
  args: {
    connection: {
      accountId: 'github:583231',
      provider: 'github',
      login: 'octocat',
      scope: 'octocat/hello-world',
      label: 'octocat/hello-world',
      state: 'ready',
    },
  },
  play: async ({ args, canvasElement }) => {
    const section = within(canvasElement).getByRole('region', { name: 'Ticket source' })
    await expect(section).toHaveTextContent('octocat/hello-world')
    await expect(section).toHaveTextContent('Read through GitHub · octocatConnected')
    await userEvent.click(within(section).getByRole('button', { name: 'Disconnect repository' }))
    await expect(args.onDisconnect).toHaveBeenCalled()
  },
}

// A Linear team shows its name, not its id, and an expired sign-in says so beside it.
export const LinearExpired: Story = {
  args: {
    connection: {
      accountId: 'linear:user-ada',
      provider: 'linear',
      login: 'ada@analytical.dev',
      scope: 'team-engine',
      label: 'Engine',
      state: 'account-expired',
    },
  },
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole('region', { name: 'Ticket source' })
    await expect(section).toHaveTextContent('Engine')
    await expect(section).not.toHaveTextContent('team-engine')
    await expect(section).toHaveTextContent(
      'Read through Linear · ada@analytical.devSign-in expired',
    )
    await expect(within(section).getByRole('button', { name: 'Disconnect team' })).toBeEnabled()
  },
}

export const NotConnected: Story = {
  args: { connection: null },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Ticket source connected')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a Ticket source' }))
    await expect(args.onConnect).toHaveBeenCalled()
  },
}
