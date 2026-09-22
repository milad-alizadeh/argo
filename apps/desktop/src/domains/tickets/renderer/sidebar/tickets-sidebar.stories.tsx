import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { connection } from '@/domains/tickets/renderer/detail/ticket-fixtures'
import { useTicketSearch } from '@/domains/tickets/renderer/state/use-ticket-search'
import { TicketsSidebarContent, type TicketsSidebarContentProps } from './tickets-sidebar'

const meta = {
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
    connection: connection('github'),
    notice: null,
    openCount: '25+',
    onManageAccounts: fn(),
  } satisfies TicketsSidebarContentProps,
} satisfies Meta<typeof TicketsSidebarContent>

export default meta
type Story = StoryObj<typeof TicketsSidebarContent>

export const Connected: Story = {
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

export const NotConnected: Story = {
  args: { connection: null, openCount: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'New Ticket' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Find a Ticket' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Accounts' })).toBeInTheDocument()
  },
}

// Linear has no new-issue page Argo can link to, so the sidebar offers none.
export const Linear: Story = {
  args: { connection: connection('linear') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'New Ticket' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Find a Ticket' })).toBeEnabled()
    await expect(
      canvas.getByRole('button', { name: 'Linear · ada@analytical.dev Connected' }),
    ).toBeInTheDocument()
  },
}

// Shown to everyone once, above the Account it asks the person to connect.
export const SignInNotice: Story = {
  args: { connection: null, openCount: null, notice: { onConnect: fn(), onDismiss: fn() } },
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'Sign-in notice' })
    await expect(notice).toHaveTextContent('Sign-ins from the earlier Argo app do not carry over.')
    await userEvent.click(within(notice).getByRole('button', { name: 'Connect an Account' }))
    await expect(args.notice?.onConnect).toHaveBeenCalled()
  },
}
