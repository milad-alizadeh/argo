import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ticketError } from '@/domains/tickets/contract/contract'
import { connection } from '@/domains/tickets/renderer/detail/ticket-fixtures'
import { connectionProblem, failureProblem } from '@/domains/tickets/renderer/lib/problems'
import { TicketProblem } from '@/domains/tickets/renderer/status/ticket-problem'

const recovery = { onRetry: fn(), onReconnect: fn(), onDisconnectSource: fn(), provider: null }

const meta = {
  title: 'Tickets/Ticket Problem',
  component: TicketProblem,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TicketProblem>

export default meta
type Story = StoryObj<typeof TicketProblem>

// Every failed read draws this one state; the error picks its icon, sentence and actions.
export const FailedRead: Story = {
  args: failureProblem('Unable to read Tickets', ticketError('github-unreachable', 'r1'), {
    ...recovery,
    provider: 'github',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Argo cannot reach GitHub.')
    // Signing in again cannot fix an unreachable GitHub, so only reading again is offered.
    await expect(canvas.queryByRole('button', { name: 'Reconnect GitHub' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(recovery.onRetry).toHaveBeenCalled()
  },
}

// A Connection whose Account GitHub refused: reconnecting brings it back, disconnecting forgets it.
export const AccountRefused: Story = {
  args: connectionProblem(connection('github', 'account-revoked'), recovery),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('GitHub no longer accepts octocat')).toBeInTheDocument()
    await expect(canvas.getByText('Reconnect it to read octocat/hello-world again.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Reconnect GitHub' }))
    await expect(recovery.onReconnect).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Disconnect repository' }))
    await expect(recovery.onDisconnectSource).toHaveBeenCalled()
  },
}
