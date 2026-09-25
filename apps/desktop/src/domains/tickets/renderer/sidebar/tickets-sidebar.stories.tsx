import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { backlog, connection } from '../detail/ticket-fixtures'
import { useTicketSearch } from '../state/use-ticket-search'
import { ticketWorkPath } from './ticket-work-path'
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
    onSelectTicket: fn(),
    workPath: ticketWorkPath(backlog().tickets),
  } satisfies TicketsSidebarContentProps,
} satisfies Meta<typeof TicketsSidebarContent>

export default meta
type Story = StoryObj<typeof TicketsSidebarContent>

export const Connected: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const views = canvas.getByRole('navigation', { name: 'Ticket views' })
    await expect(views).toHaveTextContent('All open25+')
    await expect(canvas.getByRole('heading', { name: 'Work path' })).toBeInTheDocument()
    await expect(canvas.getByText(/^Start here/)).toBeInTheDocument()
    await expect(canvas.getByText('Unlocks one Ticket')).toBeInTheDocument()
    const path = canvas.getByRole('region', { name: 'Work path' })
    const rail = path.querySelector('span.bg-border')
    const start = path.querySelector('span.bg-primary')
    const unlocks = path.querySelector('span.border-primary')
    if (!rail || !start || !unlocks) throw new Error('The work path needs its rail and markers.')
    const center = (element: Element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.left + bounds.width / 2
    }
    await expect(Math.abs(center(rail) - center(start))).toBeLessThanOrEqual(0.5)
    await expect(Math.abs(center(rail) - center(unlocks))).toBeLessThanOrEqual(0.5)
    await userEvent.click(canvas.getByRole('button', { name: /#609 Prototype the Tickets room/ }))
    await expect(args.onSelectTicket).toHaveBeenCalledWith('#609')
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
  args: { connection: null, openCount: null, workPath: null },
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
  args: {
    connection: null,
    openCount: null,
    notice: { onConnect: fn(), onDismiss: fn() },
    workPath: null,
  },
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'Sign-in notice' })
    await expect(notice).toHaveTextContent('Sign-ins from the earlier Argo app do not carry over.')
    await userEvent.click(within(notice).getByRole('button', { name: 'Connect an Account' }))
    await expect(args.notice?.onConnect).toHaveBeenCalled()
  },
}
