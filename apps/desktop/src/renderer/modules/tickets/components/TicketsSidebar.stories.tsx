import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { useTicketSearch } from '../state/useTicketSearch'
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
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-64">
        <Story />
      </div>
    ),
  ],
  // The search store outlives a story, so each starts with the field closed.
  beforeEach: () => useTicketSearch.setState({ open: false, query: '' }),
  args: {
    binding,
    notice: null,
    openCount: '25+',
    onManageAccounts: fn(),
  } satisfies TicketsSidebarContentProps,
}

export default meta
type Story = StoryObj<typeof TicketsSidebarContent>

export const Bound: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const views = canvas.getByRole('navigation', { name: 'Ticket views' })
    await expect(views).toHaveTextContent('All open25+')
    await expect(canvas.getByRole('button', { name: 'New Ticket' })).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/issues/new',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Find a Ticket' }))
    const field = canvas.getByRole('textbox', { name: 'Search Tickets' })
    await expect(field).toHaveFocus()
    await userEvent.type(field, 'crash')
    await expect(useTicketSearch.getState().query).toBe('crash')
    // Closing the field ends the search, so no hidden query filters the backlog.
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('textbox', { name: 'Search Tickets' })).toBeNull()
    await expect(useTicketSearch.getState().query).toBe('')
    await userEvent.click(canvas.getByRole('button', { name: 'GitHub · octocat Connected' }))
    await expect(args.onManageAccounts).toHaveBeenCalled()
  },
}

export const Unbound: Story = {
  args: { binding: null, openCount: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'New Ticket' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Find a Ticket' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'GitHub Accounts' })).toBeInTheDocument()
  },
}

// Shown to everyone once, above the Account it asks the person to connect.
export const SignInNotice: Story = {
  args: { binding: null, openCount: null, notice: { onConnect: fn(), onDismiss: fn() } },
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'GitHub sign-in notice' })
    await expect(notice).toHaveTextContent(
      'Accounts from the earlier Argo app are not carried over.',
    )
    await userEvent.click(within(notice).getByRole('button', { name: 'Connect GitHub' }))
    await expect(args.notice?.onConnect).toHaveBeenCalled()
  },
}
