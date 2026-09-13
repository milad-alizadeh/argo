import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'
import { TicketList } from './TicketList'
import { backlog, standalone, wayfinder } from './ticket-fixtures'

const meta: Meta<typeof TicketList> = {
  title: 'Tickets/List',
  component: TicketList,
  args: {
    backlog: backlog({ tickets: [wayfinder, standalone] }),
    selectedKey: null,
    // Fixed, so a Ticket's age reads the same however long this story sits open.
    now: new Date('2026-06-15T12:00:00Z').getTime(),
  },
}

export default meta
type Story = StoryObj<typeof TicketList>

export const Ages: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /^#607/ })).toHaveTextContent('14d')
    await expect(canvas.getByRole('button', { name: /^#273/ })).toHaveTextContent('5mo')
  },
}
