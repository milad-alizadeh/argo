import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TicketsSidebarContent, type TicketsSidebarContentProps } from './TicketsSidebar'

const binding = {
  accountId: 'github:583231',
  login: 'octocat',
  scope: 'octocat/hello-world',
  state: 'ready',
} satisfies TicketsSidebarContentProps['binding']

const meta: Meta<typeof TicketsSidebarContent> = {
  title: 'Tickets/Sidebar',
  component: TicketsSidebarContent,
  decorators: [
    (Story) => (
      <div className="h-dvh w-64">
        <Story />
      </div>
    ),
  ],
  args: { binding, openCount: 3, onManageAccounts: fn() } satisfies TicketsSidebarContentProps,
}

export default meta
type Story = StoryObj<typeof TicketsSidebarContent>

export const Bound: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const views = canvas.getByRole('navigation', { name: 'Ticket views' })
    await expect(views).toHaveTextContent('All open3')
    const account = canvas.getByRole('button', { name: 'GitHub · octocat Connected' })
    await userEvent.click(account)
    await expect(args.onManageAccounts).toHaveBeenCalled()
  },
}

export const AccessRevoked: Story = {
  args: { binding: { ...binding, state: 'account-revoked' }, openCount: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: 'GitHub · octocat Access revoked' }),
    ).toBeInTheDocument()
  },
}

export const Unbound: Story = {
  args: { binding: null, openCount: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'GitHub Accounts' }),
    ).toBeInTheDocument()
  },
}
