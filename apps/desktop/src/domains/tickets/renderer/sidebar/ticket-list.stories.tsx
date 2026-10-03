import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  backlog,
  longBacklog,
  prototype,
  standalone,
  wayfinder,
} from '@/mocks/tickets/renderer-models'
import { TicketList } from './ticket-list'

const parent = wayfinder()
const plain = standalone()

const longTicket = {
  ...parent,
  title:
    'Truncate Ticket and sidebar text before a long title can widen the Ticket list beyond its pane',
  labels: [
    { name: 'accessibility-review', color: '000000' },
    { name: 'desktop-layout', color: 'FFFFFF' },
  ],
}

const manyLabels = {
  ...plain,
  labels: [
    { name: 'enhancement', color: 'a2eeef' },
    { name: 'wallet', color: '000000' },
    { name: 'iOS', color: 'FFFFFF' },
    { name: 'onboarding', color: '5319e7' },
    { name: 'accessibility', color: null },
    { name: 'regression', color: 'b60205' },
    { name: 'customer-report', color: 'fbca04' },
    { name: 'release-blocker', color: 'd93f0b' },
  ],
}

const tagRailParent = {
  ...parent,
  children: (parent.children ?? []).map((child, index) =>
    index === 0 ? { key: manyLabels.key, title: manyLabels.title, state: 'open' as const } : child,
  ),
}

const meta = {
  title: 'Features/Tickets/Sidebar/Ticket List',
  component: TicketList,
  args: {
    backlog: backlog({ tickets: [wayfinder(), prototype(), standalone()] }),
    onSelect: fn(),
    selectedKey: null,
    // Fixed, so a Ticket's age reads the same however long this story sits open.
    now: new Date('2026-06-15T12:00:00Z').getTime(),
  },
} satisfies Meta<typeof TicketList>

export default meta
type Story = StoryObj<typeof TicketList>

export const NestedLongTitle: Story = {
  args: {
    backlog: backlog({ tickets: [longTicket, prototype()] }),
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
    await expect(parent.getByRole('button', { name: 'State: Open' })).toBeVisible()
    await expect(parent.queryByText('1/3')).toBeNull()
    const blocked = parentRow.querySelector('[data-icon="blocked"]')
    if (blocked === null) throw new Error('A blocked Ticket needs a blocked mark.')
    const labels = parent.getByRole('button', { name: 'Show 1 more label for #607' })
    await expect(within(labels).getByText('accessibility-review')).toBeVisible()
    await expect(within(labels).queryByText('desktop-layout')).toBeNull()
    await expect(parent.getByText('+1 label')).toBeVisible()
    await expect(within(list).getByRole('button', { name: /^#609.*child of #607$/ })).toBeVisible()
  },
}

const selectSidebarTicket = fn()

export const SelectedSidebarRow: Story = {
  beforeEach: () => {
    selectSidebarTicket.mockClear()
  },
  args: {
    backlog: backlog({ tickets: [longTicket, prototype()] }),
    placement: 'sidebar',
    selectedKey: '#607',
    onSelect: selectSidebarTicket,
  },
  decorators: [
    (Story) => (
      <div className="panel-sidebar panel-sidebar-start h-dvh w-64">
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const selected = await canvas.findByRole('button', { name: /^#607/ })
    await expect(selected).toHaveAttribute('aria-current', 'true')
    selected.focus()
    await expect(selected).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith('#607')
    selectSidebarTicket.mockClear()
    const fold = canvas.getByRole('button', { name: 'Collapse #607' })
    fold.focus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.queryByRole('button', { name: /^#609/ })).toBeNull()
    await expect(args.onSelect).not.toHaveBeenCalled()
    const expand = canvas.getByRole('button', { name: 'Expand #607' })
    expand.focus()
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByRole('button', { name: /^#609/ })).toHaveAccessibleName(
      /child of #607$/,
    )
    const row = selected.closest('li')
    if (row === null) throw new Error('The selected Ticket needs a list row.')
    const status = within(row).getByRole('button', { name: 'State: Open' })
    status.focus()
    await userEvent.keyboard('{Enter}')
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await waitFor(() => expect(menu).toBeVisible())
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(status).toHaveFocus())
  },
}

export const NestedExpandableTags: Story = {
  args: { backlog: backlog({ tickets: [tagRailParent, manyLabels] }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Collapse #607' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^#273.*child of #607$/ })).toBeVisible()
    const trigger = canvas.getByRole('button', { name: 'Show 4 more labels for #273' })
    await expect(trigger).toHaveTextContent('+4 labels')
    const title = canvas.getByRole('button', { name: /^#273/ })
    const row = title.closest('li')
    if (row === null) throw new Error('A Ticket needs a list row.')
    await expect(row).toHaveTextContent('enhancement')
    trigger.focus()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).not.toHaveBeenCalled()
    const popover = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Labels for #273',
    })
    await waitFor(() => expect(popover).toBeVisible())
    for (const label of manyLabels.labels) {
      await expect(within(popover).getByText(label.name)).toBeVisible()
    }
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).toBeNull(),
    )
    await expect(trigger).toHaveFocus()
  },
}

// Until the provider answers, a search draws the saved matches and says they are only those.
export const SearchShowsSavedMatchesFirst: Story = {
  args: {
    backlog: backlog({
      tickets: [standalone()],
      query: 'planner',
      total: 1,
      partial: true,
      sync: { refreshing: true, problem: null },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1 saved match')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^#273/ })).toBeVisible()
    await expect(canvas.getByText(/^Refreshing from/)).toBeVisible()
  },
}

// While the Account cannot be called, the saved rows stay and their status controls stop editing.
export const SavedRowsWithoutWrites: Story = {
  args: {
    backlog: backlog({
      provider: 'linear',
      tickets: [standalone()],
      writable: false,
      priorityChoices: [],
      sync: {
        refreshing: false,
        problem: {
          icon: 'account-expired',
          title: 'ada needs to sign in to Linear again',
          description: 'Sign in again to read and change Tickets.',
          alert: false,
          actions: [],
        },
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /^#273/ })).toBeVisible()
    await expect(canvas.getByText('ada needs to sign in to Linear again')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /^(State|Status):/ })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^Priority:/ })).toBeNull()
  },
}

export const LoadingMore: Story = {
  args: {
    backlog: backlog({ tickets: [standalone()], hasMore: true, loadingMore: true }),
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-100">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Reading more Tickets' }),
    ).toBeVisible()
  },
}

async function reachTicketListEnd(scroll: HTMLElement) {
  await waitFor(async () => {
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(scroll.scrollTop + scroll.clientHeight).toBe(scroll.scrollHeight)
  })
}

export const ScrollEdgesFollowTheReader: Story = {
  args: { backlog: backlog({ tickets: longBacklog(80) }) },
  decorators: [
    (Story) => (
      <div className="h-dvh w-100">
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const scroll = canvasElement.querySelector<HTMLElement>('[data-slot="ticket-list-scroll"]')
    if (scroll === null) throw new Error('The Ticket list has no scroll container.')
    const first = await canvas.findByRole('button', { name: /^#100/ })
    await expect(first).toBeVisible()
    await expect(scroll.scrollTop).toBe(0)

    scroll.scrollTop = 100
    scroll.dispatchEvent(new Event('scroll'))
    await waitFor(() => {
      expect(scroll.scrollTop).toBeGreaterThan(0)
      expect(scroll.scrollTop).toBeLessThan(scroll.scrollHeight - scroll.clientHeight)
    })

    await reachTicketListEnd(scroll)
    await expect(scroll.scrollTop).toBe(scroll.scrollHeight - scroll.clientHeight)
    const last = await canvas.findByRole('button', { name: /^#179/ })
    await userEvent.click(last)
    await expect(args.onSelect).toHaveBeenCalledWith('#179')
    const lastRow = last.closest('li')
    if (lastRow === null) throw new Error('The last Ticket needs a list row.')
    const previousControl = lastRow.querySelector<HTMLButtonElement>('[aria-label="State: Open"]')
    if (previousControl === null) throw new Error('The Ticket status needs a keyboard control.')
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await expect(previousControl).toHaveFocus()

    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll'))
    await waitFor(() => expect(scroll.scrollTop).toBe(0))
    await expect(await canvas.findByRole('button', { name: /^#100/ })).toBeVisible()
  },
}
