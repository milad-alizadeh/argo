import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { backlog, prototype, standalone, wayfinder } from '../detail/ticket-fixtures'
import { TicketList } from './ticket-list'

const longTicket = {
  ...wayfinder,
  title:
    'Truncate Ticket and sidebar text before a long title can widen the Ticket list beyond its pane',
  labels: [
    { name: 'accessibility-review', color: 'a2eeef' },
    { name: 'desktop-layout', color: '5319e7' },
  ],
}

const manyLabels = {
  ...standalone,
  labels: [
    { name: 'enhancement', color: 'a2eeef' },
    { name: 'wallet', color: '0e8a16' },
    { name: 'iOS', color: '1d76db' },
    { name: 'onboarding', color: '5319e7' },
    { name: 'accessibility', color: 'd4c5f9' },
    { name: 'regression', color: 'b60205' },
    { name: 'customer-report', color: 'fbca04' },
    { name: 'release-blocker', color: 'd93f0b' },
  ],
}

const tagRailParent = {
  ...wayfinder,
  children: wayfinder.children.map((child, index) =>
    index === 0 ? { key: manyLabels.key, title: manyLabels.title, state: 'open' as const } : child,
  ),
}

const meta = {
  title: 'Tickets/List',
  component: TicketList,
  args: {
    backlog: backlog({ tickets: [wayfinder, prototype, standalone] }),
    onSelect: fn(),
    selectedKey: null,
    // Fixed, so a Ticket's age reads the same however long this story sits open.
    now: new Date('2026-06-15T12:00:00Z').getTime(),
  },
} satisfies Meta<typeof TicketList>

export default meta
type Story = StoryObj<typeof TicketList>

const visibleMatches = (elements: HTMLElement[]) =>
  elements.filter((element) => element.getClientRects().length > 0)

export const NestedLongTitle: Story = {
  args: {
    backlog: backlog({ tickets: [longTicket, prototype] }),
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
    const title = within(list).getByRole('button', { name: /^#607/ })
    const parentRow = title.closest('li')
    if (parentRow === null) throw new Error('A parent Ticket needs a list row.')
    const parent = within(parentRow)
    const status = parent.getByRole('button', { name: 'State: Open' })
    await expect(parent.queryByText('1/3')).toBeNull()
    const blocked = parentRow.querySelector('svg.lucide-ban')
    if (blocked === null) throw new Error('A blocked Ticket needs a blocked mark.')
    await expect(blocked.parentElement).toHaveClass('text-destructive')
    const shownLabel = visibleMatches(parent.getAllByText(longTicket.labels[0]?.name ?? ''))[0]
    if (!shownLabel) throw new Error('The compact row needs one visible label.')
    await expect(shownLabel.scrollWidth).toBeLessThanOrEqual(shownLabel.clientWidth)
    await expect(shownLabel.getBoundingClientRect().top).toBeGreaterThan(
      title.getBoundingClientRect().top,
    )
    await expect(
      visibleMatches(parent.queryAllByText(longTicket.labels[1]?.name ?? '')),
    ).toHaveLength(0)
    await expect(parent.getByText('+1 label')).toBeVisible()
    await expect(title.scrollWidth).toBeGreaterThanOrEqual(title.clientWidth)
    const titleLineHeight = Number.parseFloat(getComputedStyle(title).lineHeight)
    const titleCenter = title.getBoundingClientRect().top + titleLineHeight / 2
    const statusCenter =
      status.getBoundingClientRect().top + status.getBoundingClientRect().height / 2
    await expect(Math.abs(statusCenter - titleCenter)).toBeLessThanOrEqual(1)
    await expect(within(list).getByRole('button', { name: /^#609.*child of #607$/ })).toBeVisible()
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
  },
}

export const NestedExpandableTags: Story = {
  args: { backlog: backlog({ tickets: [tagRailParent, manyLabels] }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Collapse #607' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^#273.*child of #607$/ })).toBeVisible()
    const category = visibleMatches(canvas.getAllByText('enhancement'))[0]
    if (!category) throw new Error('The Ticket category needs to remain visible.')
    await expect(category).toBeVisible()
    const trigger = canvas.getByRole('button', { name: 'Show 4 more labels for #273' })
    await expect(trigger).toHaveTextContent('+4 labels')
    const title = canvas.getByRole('button', { name: /^#273/ })
    const row = title.closest('li')
    if (row === null) throw new Error('A Ticket needs a list row.')
    const key = within(row).getByText('#273', { selector: 'span[aria-hidden="true"]' })
    const status = within(row).getByRole('button', { name: 'State: Open' })
    const center = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top + bounds.height / 2
    }
    for (const element of [key, status, category, trigger]) {
      await expect(Math.abs(center(element) - center(title))).toBeLessThanOrEqual(0.5)
    }
    await userEvent.click(trigger)
    await expect(args.onSelect).not.toHaveBeenCalled()
    const popover = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Labels for #273',
    })
    await waitFor(() => expect(popover).toBeVisible())
    for (const label of manyLabels.labels) {
      await expect(within(popover).getByText(label.name)).toBeVisible()
    }
  },
}
