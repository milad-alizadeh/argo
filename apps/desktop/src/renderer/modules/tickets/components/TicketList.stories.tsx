import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'
import { TicketList } from './TicketList'
import { backlog, standalone, wayfinder } from './ticket-fixtures'

const longTicket = {
  ...standalone,
  title:
    'Truncate Ticket and sidebar text before a long title can widen the Ticket list beyond its pane',
  labels: [
    { name: 'this-is-a-very-long-provider-label', color: 'a2eeef' },
    { name: 'another-long-provider-label', color: '5319e7' },
  ],
}

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

export const LongTitleWithLabels: Story = {
  args: {
    backlog: backlog({ tickets: [longTicket] }),
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-[360px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list')
    const title = within(list).getByText(longTicket.title)
    await expect(title.clientWidth).toBeGreaterThan(0)
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
  },
}
