import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ticketError } from '@/core/tickets/contract'
import { TicketsRoom } from './TicketsRoom'
import { ticketsView } from './ticket-fixtures'

const meta: Meta<typeof TicketsRoom> = {
  title: 'Tickets/Room',
  component: TicketsRoom,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
  args: { view: ticketsView, notice: null },
}

export default meta
type Story = StoryObj<typeof TicketsRoom>

export const Backlog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('All open · 3 Tickets')).toBeInTheDocument()
    const rows = canvas.getAllByRole('button', { name: /^#\d+/ })
    // A listed child sits under its parent, whatever order GitHub listed them in.
    await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual(['#607', '#609', '#273'])
    await expect(rows[0]).toHaveTextContent('Blocked by 1 open Ticket')
    await expect(rows[0]).toHaveTextContent('1 of 2 children closed')
    await expect(rows[1]).toHaveAccessibleName(/child of #607$/)
    await expect(canvas.getByText('Select a Ticket')).toBeInTheDocument()
    await userEvent.click(rows[0] as HTMLElement)
    await expect(rows[0]).toHaveAttribute('aria-current', 'true')
    const detail = canvas.getByRole('article', { name: 'Ticket #607' })
    await expect(detail).toHaveTextContent('Wayfinder: the Tickets room, end to end')
    await expect(detail).toHaveTextContent('PRD')
    await expect(within(detail).getByText('wayfinder')).toBeInTheDocument()
    await expect(
      within(detail).getByRole('region', { name: 'Children · 1 of 2 closed' }),
    ).toBeInTheDocument()
    await expect(within(detail).getByRole('region', { name: 'Blocked by · 2' })).toBeInTheDocument()
  },
}

export const NoDependencyFacts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^#609/ }))
    await expect(canvas.getByText('No description.')).toBeInTheDocument()
    await expect(
      canvas.getByText('GitHub gives no dependency information for this Ticket.'),
    ).toBeInTheDocument()
  },
}

export const Unbind: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('octocat/hello-world')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Unbind' }))
    await expect(ticketsView.kind === 'tickets' && ticketsView.onUnbind).toHaveBeenCalled()
  },
}

export const NoProject: Story = {
  args: { view: { kind: 'no-project' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Select a Project to read its Tickets'),
    ).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: { view: { kind: 'loading', label: 'Reading Tickets' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Reading Tickets' }),
    ).toHaveTextContent('Reading Tickets')
  },
}

const failure = (code: 'account-revoked' | 'github-unreachable') => ({
  kind: 'failure' as const,
  title: 'Unable to read Tickets',
  error: ticketError(code, 'request-1'),
  onRetry: fn(),
  onReconnect: fn(),
})

export const GitHubUnreachable: Story = {
  args: { view: failure('github-unreachable') },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Argo cannot reach GitHub.')).toBeInTheDocument()
    // Signing in again cannot fix an unreachable GitHub, so only reading again is offered.
    await expect(canvas.queryByRole('button', { name: 'Reconnect GitHub' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.view.kind === 'failure' && args.view.onRetry).toHaveBeenCalled()
  },
}

export const AccessRevoked: Story = {
  args: { view: failure('account-revoked') },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Reconnect GitHub' }))
    await expect(args.view.kind === 'failure' && args.view.onReconnect).toHaveBeenCalled()
  },
}

export const BindingAccountRevoked: Story = {
  args: {
    view: {
      kind: 'binding-problem',
      binding: {
        accountId: 'github:583231',
        login: 'octocat',
        scope: 'octocat/hello-world',
        state: 'account-revoked',
      },
      onReconnect: fn(),
      onUnbind: fn(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('GitHub no longer accepts octocat')).toBeInTheDocument()
    await expect(canvas.getByText('octocat/hello-world')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Reconnect GitHub' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Unbind' })).toBeInTheDocument()
  },
}

export const SignInNotice: Story = {
  args: { notice: { onConnect: fn(), onDismiss: fn() } },
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'GitHub sign-in notice' })
    await expect(notice).toHaveTextContent(
      'Accounts from the earlier Argo app are not carried over.',
    )
    await userEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    await expect(args.notice?.onDismiss).toHaveBeenCalled()
  },
}
