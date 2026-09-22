import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'
import {
  backlog,
  engine,
  standalone,
  wayfinder,
} from '@/domains/tickets/renderer/detail/ticket-fixtures'
import { TicketList } from '@/domains/tickets/renderer/sidebar/ticket-list'
import { STATUSES } from '@/domains/tickets/renderer/status/status-fixtures'

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
  title: 'Tickets/Sidebar/List',
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

// A Linear row draws priority, then key, then status, leftmost first.
export const ChangePriority: Story = {
  args: {
    backlog: backlog({ provider: 'linear', tickets: [engine], statuses: STATUSES.linear }),
  },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement)
      .getByRole('button', { name: /^ENG-12/ })
      .closest('div')
    if (row === null) throw new Error('The row needs its wrapper.')
    const priority = within(row).getByRole('button', { name: 'Priority: High' })
    const key = within(row).getByText('ENG-12', { selector: 'span[aria-hidden="true"]' })
    const status = within(row).getByRole('button', { name: 'Status: In Review' })
    await expect(priority.getBoundingClientRect().left).toBeLessThan(
      key.getBoundingClientRect().left,
    )
    await expect(key.getBoundingClientRect().left).toBeLessThan(status.getBoundingClientRect().left)
    await userEvent.click(priority)
    // The portal mounts slower than testing-library's 1s default in this row's dev-mode render.
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
      {},
      { timeout: 3000 },
    )
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Urgent' }))
    await expect(args.backlog.onChangePriority).toHaveBeenCalledWith('ENG-12', {
      level: 1,
      label: 'Urgent',
    })
  },
}

export const LongTitleWithLabels: Story = {
  args: {
    backlog: backlog({ tickets: [longTicket] }),
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-100">
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
    await expect(blocked.parentElement).toHaveClass('text-danger')
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
