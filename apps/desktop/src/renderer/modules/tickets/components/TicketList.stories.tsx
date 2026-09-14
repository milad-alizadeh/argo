import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'
import { TicketList } from './TicketList'
import { backlog, standalone, wayfinder } from './ticket-fixtures'

const longTicket = {
  ...wayfinder,
  title:
    'Truncate Ticket and sidebar text before a long title can widen the Ticket list beyond its pane',
  labels: [
    { name: 'accessibility-review', color: 'a2eeef' },
    { name: 'desktop-layout', color: '5319e7' },
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
      <div className="h-dvh w-[400px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list')
    const title = within(list).getByText(longTicket.title)
    const status = within(list).getByRole('button', { name: 'State: Open' })
    const progress = within(list).getByText('1/2')
    const blocked = list.querySelector('svg.lucide-ban')
    if (blocked === null) throw new Error('A blocked Ticket needs a blocked mark.')
    await expect(blocked).not.toHaveClass('text-danger')
    for (const label of longTicket.labels) {
      const badge = within(list).getByText(label.name)
      await expect(badge.scrollWidth).toBeLessThanOrEqual(badge.clientWidth)
      await expect(badge.getBoundingClientRect().top).toBeGreaterThan(
        title.getBoundingClientRect().top,
      )
    }
    await expect(title.clientHeight).toBeGreaterThan(20)
    const titleLineHeight = Number.parseFloat(getComputedStyle(title).lineHeight)
    const titleCenter = title.getBoundingClientRect().top + titleLineHeight / 2
    const statusCenter =
      status.getBoundingClientRect().top + status.getBoundingClientRect().height / 2
    await expect(Math.abs(statusCenter - titleCenter)).toBeLessThanOrEqual(1)
    const progressCenter =
      progress.getBoundingClientRect().top + progress.getBoundingClientRect().height / 2
    await expect(Math.abs(progressCenter - titleCenter)).toBeLessThanOrEqual(1)
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
  },
}
