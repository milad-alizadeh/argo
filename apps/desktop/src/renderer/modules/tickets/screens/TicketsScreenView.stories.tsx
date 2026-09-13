import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { TicketsSidebarContent } from '../components/TicketsSidebar'
import {
  backlog,
  engine,
  longBacklog,
  STATUSES,
  standalone,
  ticketsView,
} from '../components/ticket-fixtures'
import { TicketsScreen } from './TicketsScreenView'

const connection = {
  accountId: 'github:583231',
  provider: 'github',
  login: 'octocat',
  scope: 'octocat/hello-world',
  label: 'octocat/hello-world',
  state: 'ready',
} as const

const meta: Meta<typeof TicketsScreen> = {
  title: 'Tickets/Screen',
  component: TicketsScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <div className="h-dvh w-full">
        <MemoryRouter>
          <CockpitShell
            sidebar={
              <TicketsSidebarContent
                connection={connection}
                notice={parameters.notice ?? null}
                onManageAccounts={fn()}
                openCount="3"
              />
            }
          >
            <Story />
          </CockpitShell>
        </MemoryRouter>
      </div>
    ),
  ],
  args: { view: ticketsView() },
}

export default meta
type Story = StoryObj<typeof TicketsScreen>

async function readsTheBacklog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('All open · 3 Tickets')).toBeInTheDocument()
  const rows = canvas.getAllByRole('button', { name: /^#\d+/ })
  // A listed child sits under its parent, whatever order GitHub listed them in.
  await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual(['#607', '#609', '#273'])
  await expect(rows[0]).toHaveTextContent('Blocked by 1 open Ticket')
  await expect(rows[0]).toHaveTextContent('1 of 2 children closed')
  await expect(rows[1]).toHaveAccessibleName(/child of #607$/)
  // Each row's state is an icon that opens a menu, named for a screen reader.
  await expect(canvas.getAllByRole('button', { name: 'State: Open' })).toHaveLength(3)
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
}

async function readsNoDependencyFacts(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: /^#609/ }))
  await expect(canvas.getByText('No description.')).toBeInTheDocument()
  await expect(
    canvas.getByText('GitHub gives no dependency information for this Ticket.'),
  ).toBeInTheDocument()
}

async function movesTheInspector(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse Ticket inspector' }))
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: 'Open Ticket inspector' })).toBeInTheDocument(),
  )
  // Choosing a Ticket opens the inspector it would otherwise land in unseen.
  await userEvent.click(canvas.getByRole('button', { name: /^#273/ }))
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: 'Collapse Ticket inspector' })).toBeInTheDocument(),
  )
  await expect(canvas.getByRole('article', { name: 'Ticket #273' })).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: 'Expand Ticket sidebar' }))
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: 'Restore Ticket sidebar' })).toBeInTheDocument(),
  )
}

export const Backlog: Story = {
  play: async ({ canvasElement }) => {
    await readsTheBacklog(canvasElement)
    await readsNoDependencyFacts(canvasElement)
    await movesTheInspector(canvasElement)
  },
}

const retryLoadMore = fn()

export const MoreTicketsUnavailable: Story = {
  args: {
    view: {
      kind: 'tickets',
      projectId: 'storybook-project',
      backlog: backlog({
        hasMore: true,
        loadMoreError: 'Argo cannot reach GitHub.',
        onRetryLoadMore: retryLoadMore,
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /^#607/ })).toBeInTheDocument()
    // The toast draws in a portal outside the canvas, hidden from the accessibility tree while an
    // offscreen alert announces its words, so it is found by its slot rather than by role.
    const body = canvasElement.ownerDocument.body
    await waitFor(() => expect(body.querySelector('[data-slot="toast"]')).not.toBeNull())
    const shown = within(body.querySelector('[data-slot="toast"]') as HTMLElement)
    await expect(shown.getByText('Argo cannot reach GitHub.')).toBeInTheDocument()
    await userEvent.click(shown.getByText('Try again'))
    await expect(retryLoadMore).toHaveBeenCalled()
  },
}

// A parent's chevron folds its children away and brings them back.
export const FoldedParent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const fold = canvas.getByRole('button', { name: 'Collapse #607' })
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(fold)
    await expect(canvas.queryByRole('button', { name: /^#609/ })).toBeNull()
    const unfold = canvas.getByRole('button', { name: 'Expand #607' })
    await expect(unfold).toHaveAttribute('aria-expanded', 'false')
    // A Ticket with no listed child has nothing to fold.
    await expect(canvas.queryByRole('button', { name: /^(Collapse|Expand) #273$/ })).toBeNull()
    await userEvent.click(unfold)
    await expect(canvas.getByRole('button', { name: /^#609/ })).toHaveAccessibleName(
      /child of #607$/,
    )
  },
}

const branch = (number: number, title: string, children: number[] = []) => ({
  ...standalone,
  key: `#${number}`,
  url: `https://github.com/octocat/hello-world/issues/${number}`,
  title,
  labels: [],
  children: children.map((child) => ({
    key: `#${child}`,
    title: `#${child}`,
    state: 'open' as const,
  })),
})

// Tree lines join each child to its parent: a branch runs on past a child with a later sibling.
export const TicketTree: Story = {
  args: {
    view: ticketsView({
      tickets: [
        branch(700, 'Wayfinder: the planner', [701, 702]),
        branch(701, 'Read the plan', [703]),
        branch(703, 'Parse the plan file'),
        branch(702, 'Draw the plan'),
        standalone,
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('button', { name: /^#\d+/ })
    await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual([
      '#700',
      '#701',
      '#703',
      '#702',
      '#273',
    ])
    await expect(rows[2]).toHaveAccessibleName(/child of #701$/)
    await expect(rows[3]).toHaveAccessibleName(/child of #700$/)
  },
}

// A Linear row carries its team key and workflow status; the Detail adds its priority.
export const LinearBacklog: Story = {
  args: { view: ticketsView({ provider: 'linear', tickets: [engine] }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Moving a Ticket from its row leaves the Ticket selected where it was.
    await userEvent.click(canvas.getByRole('button', { name: 'Status: In Review' }))
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Done' }))
    const { backlog } = args.view.kind === 'tickets' ? args.view : { backlog: null }
    await expect(backlog?.onChangeStatus).toHaveBeenCalledWith('ENG-12', STATUSES.linear[4])
    await expect(canvas.getByText('Select a Ticket')).toBeInTheDocument()
    const row = canvas.getByRole('button', { name: /^ENG-12/ })
    await userEvent.click(row)
    const detail = canvas.getByRole('article', { name: 'Ticket ENG-12' })
    await expect(detail).toHaveTextContent('PriorityHigh')
  },
}

// The one-time notice sits in the sidebar at its narrowest, and nothing in it spills out.
export const SignInNotice: Story = {
  parameters: { notice: { onConnect: fn(), onDismiss: fn() } },
  play: async ({ canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'Sign-in notice' })
    const edge = notice.getBoundingClientRect().right
    for (const button of within(notice).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(edge)
    }
    await expect(notice.scrollWidth).toBeLessThanOrEqual(notice.clientWidth)
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

// Reading the next page starts before the last row is reached.
export const LongBacklog: Story = {
  args: {
    view: ticketsView({ tickets: longBacklog(40), hasMore: true, onLoadMore: fn() }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('All open · 40+ Tickets')).toBeInTheDocument()
    // Scrolling the list alone, as a wheel does; scrollIntoView would also scroll the panels around it.
    const list = canvas.getByRole('region', { name: 'Backlog' }).querySelector('ul')
    if (list) list.scrollTop = list.scrollHeight
    await waitFor(() =>
      expect(args.view.kind === 'tickets' && args.view.backlog.onLoadMore).toHaveBeenCalled(),
    )
  },
}

// GitHub answers the search and counts every match, not only the page read so far.
export const SearchResults: Story = {
  args: {
    view: ticketsView({ tickets: [standalone], query: 'wayfinder', total: 12, hasMore: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12 matches')).toBeInTheDocument()
    await expect(canvas.getAllByRole('button', { name: /^#\d+/ })).toHaveLength(1)
  },
}

export const NoMatches: Story = {
  args: { view: ticketsView({ tickets: [], query: 'nothing', total: 0 }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No open Tickets match')).toBeInTheDocument()
  },
}
