import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { TicketsSidebarContent } from '../components/TicketsSidebar'
import { longBacklog, standalone, ticketsView } from '../components/ticket-fixtures'
import { TicketsScreen } from './TicketsScreenView'

const binding = {
  accountId: 'github:583231',
  login: 'octocat',
  scope: 'octocat/hello-world',
  state: 'ready',
} as const

const meta: Meta<typeof TicketsScreen> = {
  title: 'Tickets/Screen',
  component: TicketsScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter>
          <CockpitShell
            sidebar={
              <TicketsSidebarContent
                binding={binding}
                notice={null}
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
