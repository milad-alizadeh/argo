import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import { AccountsPanel } from '@/domains/accounts/renderer'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import {
  backlog,
  connection,
  engine,
  longBacklog,
  noDetail,
  octocat,
  readPath,
  standalone,
  ticketsView,
} from '@/mocks/tickets/renderer-models'
import { ticketStatuses } from '@/mocks/tickets/scenario'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { ConnectSourceFields } from '../connection/connect-source-form'
import type { TicketsScreenProps } from '../hooks/use-tickets-view'
import { ticketWorkPath } from '../sidebar/ticket-work-path'
import { TicketsSidebarContent } from '../sidebar/tickets-sidebar'
import { TicketsScreen } from './tickets-screen-view'

// The screen no longer holds its own selection (#2134: a Session's "Open Ticket" must land on the
// same Ticket after a reload), so a story stands in for the router state that owns it in the app.
type TicketsScreenStoryProps = TicketsScreenProps & {
  notice?: { onConnect: () => void; onDismiss: () => void } | null
}

function TicketsScreenStory({ view, notice = null }: TicketsScreenStoryProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    view.kind === 'tickets' ? view.selectedKey : null,
  )
  const current =
    view.kind === 'tickets'
      ? {
          ...view,
          selectedKey,
          onBack: () => {
            view.onBack()
            setSelectedKey(null)
          },
          onSelect: (key: string) => {
            view.onSelect(key)
            setSelectedKey(key)
          },
        }
      : view
  return (
    <AppShell
      leftHeader={<ProjectSwitcher />}
      sidebar={
        <TicketsSidebarContent
          connection={connection('github')}
          notice={notice}
          onManageAccounts={fn()}
          onSelectTicket={current.kind === 'tickets' ? current.onSelect : () => {}}
          openCount={
            current.kind === 'tickets'
              ? String(current.backlog.total ?? current.backlog.tickets.length)
              : '3'
          }
          workPath={current.kind === 'tickets' ? ticketWorkPath(current.backlog.tickets) : null}
        />
      }
    >
      <TicketsScreen view={current} />
    </AppShell>
  )
}

// The repository-connect form draws inline in the Accounts panel once an Account connects (#2411).
function AccountToRepositoryForm() {
  const [accountId, setAccountId] = useState<string | null>(octocat().id)
  return (
    <AccountsPanel
      connect={
        <ConnectSourceFields
          accountId={accountId}
          accounts={[octocat()]}
          error={null}
          onConnectSource={fn()}
          onSelectAccount={setAccountId}
          pending={false}
          sources={{
            state: 'listed',
            scopes: [{ scope: 'octocat/hello-world', label: 'octocat/hello-world' }],
          }}
        />
      }
      disconnectError={null}
      disconnecting={null}
      harnesses={null}
      listError={null}
      listing={{ accounts: [octocat()], notice: false, providers: ['github'] }}
      onDisconnect={fn()}
      signIn={{
        cancel: fn(),
        challenge: null,
        connected: null,
        error: null,
        openProvider: fn(),
        phase: 'idle',
        provider: null,
        start: fn(),
      }}
    />
  )
}

const meta = {
  title: 'Features/Tickets/Screens/Tickets',
  component: TicketsScreenStory,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </div>
    ),
  ],
  args: {
    view: { ...ticketsView(), onBack: fn(), onSelect: fn(), onOpenSession: fn() },
  },
} satisfies Meta<typeof TicketsScreenStory>

export default meta
type Story = StoryObj<typeof TicketsScreenStory>

export const PaneLayout: Story = {
  args: {
    view: ticketsView({
      tickets: backlog().tickets.map((ticket) => ({
        ...ticket,
        title: `${ticket.title}: Preserve navigation across project workspaces and long repository paths`,
      })),
    }),
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Backlog' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    const opener = canvas.getByRole('button', { name: 'Open sidebar' })
    await waitFor(() => expect(opener).toHaveFocus())
    await userEvent.click(opener)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus(),
    )
    await userEvent.click(
      within(canvas.getByRole('region', { name: 'Backlog' })).getByRole('button', {
        name: /^#607/,
      }),
    )
    await expect(await canvas.findByRole('article', { name: 'Ticket #607' })).toBeVisible()
  },
}

async function readsTheBacklog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const list = within(canvas.getByRole('region', { name: 'Backlog' }))
  await expect(canvas.getByText('All open · 3 Tickets')).toBeInTheDocument()
  const rows = list.getAllByRole('button', { name: /^#\d+/ })
  // A listed child sits under its parent, whatever order GitHub listed them in.
  await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual(['#607', '#609', '#273'])
  const parentRow = rows[0]?.closest('li')
  if (parentRow === null || parentRow === undefined) throw new Error('A Ticket needs a list row.')
  await expect(parentRow).toHaveTextContent('Blocked by 1 open Ticket')
  await expect(parentRow).toHaveTextContent('1 of 3 children closed')
  await expect(within(parentRow).queryByText(/^\+\d+ labels?$/)).toBeNull()
  await expect(rows[1]).toHaveAccessibleName(/child of #607$/)
  await expect(list.getByRole('button', { name: 'Collapse #607' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  // Each row's state is an icon that opens a menu, named for a screen reader.
  await expect(list.getAllByRole('button', { name: 'State: Open' })).toHaveLength(3)
}

export const Backlog: Story = {
  play: async ({ args, canvasElement }) => {
    await readsTheBacklog(canvasElement)
    const canvas = within(canvasElement)
    const list = within(canvas.getByRole('region', { name: 'Backlog' }))
    await userEvent.click(list.getByRole('button', { name: /^#607/ }))
    const detail = canvas.getByRole('article', { name: 'Ticket #607' })
    await expect(detail).toBeVisible()
    await expect(canvas.getByRole('complementary', { name: 'Tickets sidebar' })).toHaveTextContent(
      'Work path',
    )
    await userEvent.click(canvas.getByRole('link', { name: 'Back to Tickets' }))
    if (args.view.kind !== 'tickets') throw new Error('The backlog story needs a Tickets view.')
    await expect(args.view.onBack).toHaveBeenCalled()
    await expect(canvas.getByRole('region', { name: 'Backlog' })).toBeVisible()
  },
}

export const AccountToRepositoryConnection: StoryObj<typeof AccountToRepositoryForm> = {
  render: () => <AccountToRepositoryForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('listitem', { name: 'GitHub Account octocat' }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: 'Account' })).toHaveTextContent(
      'GitHub · octocat',
    )
    await expect(canvas.getByRole('combobox', { name: 'Repository' })).toBeEnabled()
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
      selectedKey: null,
      detail: noDetail(),
      now: new Date('2026-09-25T12:00:00Z').getTime(),
      onBack: fn(),
      onSelect: fn(),
      onOpenSession: fn(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = within(canvas.getByRole('region', { name: 'Backlog' }))
    await expect(list.getByRole('button', { name: /^#607/ })).toBeInTheDocument()
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

const retryRefresh = fn()

// A failed refresh keeps the saved rows, says so above them, and offers another read.
export const RefreshFailedKeepsRows: Story = {
  args: {
    view: {
      kind: 'tickets',
      projectId: 'storybook-project',
      backlog: backlog({
        sync: {
          refreshing: true,
          problem: {
            icon: 'connection-offline',
            title: 'Argo could not refresh Tickets. These are the last saved.',
            description: 'Argo cannot reach GitHub.',
            alert: true,
            actions: [{ label: 'Try again', onClick: retryRefresh, primary: true }],
          },
        },
      }),
      selectedKey: null,
      detail: noDetail(),
      now: new Date('2026-09-25T12:00:00Z').getTime(),
      onBack: fn(),
      onSelect: fn(),
      onOpenSession: fn(),
    },
  },
  play: async ({ canvasElement }) => {
    const list = within(within(canvasElement).getByRole('region', { name: 'Backlog' }))
    await expect(list.getByRole('button', { name: /^#607/ })).toBeInTheDocument()
    await expect(list.getByText('Refreshing from GitHub…')).toBeInTheDocument()
    const alert = within(list.getByRole('alert'))
    await expect(alert.getByText('Argo cannot reach GitHub.')).toBeInTheDocument()
    await userEvent.click(alert.getByRole('button', { name: 'Try again' }))
    await expect(retryRefresh).toHaveBeenCalled()
  },
}

// A parent's chevron folds its children away and brings them back.
export const FoldedParent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = within(canvas.getByRole('region', { name: 'Backlog' }))
    const fold = list.getByRole('button', { name: 'Collapse #607' })
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(fold)
    await expect(list.queryByRole('button', { name: /^#609/ })).toBeNull()
    const unfold = list.getByRole('button', { name: 'Expand #607' })
    await expect(unfold).toHaveAttribute('aria-expanded', 'false')
    // A Ticket with no listed child has nothing to fold.
    await expect(list.queryByRole('button', { name: /^(Collapse|Expand) #273$/ })).toBeNull()
    await userEvent.click(unfold)
    await expect(list.getByRole('button', { name: /^#609/ })).toHaveAccessibleName(/child of #607$/)
  },
}

const branch = (number: number, title: string, children: number[] = []) => ({
  ...standalone(),
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
        standalone(),
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

// A linked Ticket the active list no longer holds opens from its saved row.
export const UnlistedTicket: Story = {
  args: {
    view: {
      ...ticketsView(),
      selectedKey: '#388',
      detail: { ...noDetail(), ticket: readPath(), statuses: ticketStatuses('github') },
    },
  },
  play: async ({ canvasElement }) => {
    const detail = within(within(canvasElement).getByRole('article', { name: 'Ticket #388' }))
    await expect(detail.getByText('Read one Ticket by its ID.')).toBeInTheDocument()
    await expect(detail.getByText('Closed as completed')).toBeInTheDocument()
  },
}

// A failed by-ID read sits above the saved Ticket rather than replacing it.
export const SavedTicketRefreshFailed: Story = {
  args: {
    view: {
      ...ticketsView(),
      selectedKey: '#388',
      detail: {
        ...noDetail(),
        ticket: readPath(),
        problem: {
          icon: 'connection-offline',
          title: 'Argo could not refresh this Ticket. This is the last saved.',
          description: 'Argo cannot reach GitHub.',
          alert: true,
          actions: [],
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      within(canvas.getByRole('alert')).getByText('Argo cannot reach GitHub.'),
    ).toBeVisible()
    await expect(canvas.getByRole('article', { name: 'Ticket #388' })).toBeVisible()
  },
}

// A Ticket opened by an Argo link waits for its by-ID read before anything is drawn.
export const OpeningTicket: Story = {
  args: {
    view: { ...ticketsView(), selectedKey: 'ENG-3', detail: { ...noDetail(), reading: true } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Opening ENG-3…')
  },
}

const retryOpen = fn()

// A Ticket the provider cannot find, with nothing saved, says so and offers another read.
export const TicketNotFound: Story = {
  args: {
    view: {
      ...ticketsView(),
      selectedKey: '#9999',
      detail: {
        ...noDetail(),
        problem: {
          icon: 'not-visible',
          title: 'Argo could not open this Ticket.',
          description: 'The Ticket was not found.',
          alert: true,
          actions: [{ label: 'Try again', onClick: retryOpen, primary: true }],
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const alert = within(within(canvasElement).getByRole('alert'))
    await expect(alert.getByText('Argo could not open this Ticket.')).toBeInTheDocument()
    await userEvent.click(alert.getByRole('button', { name: 'Try again' }))
    await expect(retryOpen).toHaveBeenCalled()
  },
}

// A Linear row carries its team key and workflow status; the Detail's own stories check its priority.
export const LinearBacklog: Story = {
  args: {
    view: ticketsView({
      provider: 'linear',
      tickets: [engine()],
      onChangeStatus: fn(),
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Moving a Ticket from its row leaves the Ticket selected where it was.
    await userEvent.click(canvas.getByRole('button', { name: 'Status: In Review' }))
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Done' }))
    const { backlog } = args.view.kind === 'tickets' ? args.view : { backlog: null }
    await expect(backlog?.onChangeStatus).toHaveBeenCalledWith(
      'ENG-12',
      ticketStatuses('linear')[4],
    )
    await expect(canvas.getByRole('button', { name: /^ENG-12/ })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Status: In Review' })).toBeVisible()
  },
}

// The one-time notice sits in the sidebar at its narrowest, and nothing in it spills out.
export const SignInNotice: Story = {
  args: { notice: { onConnect: fn(), onDismiss: fn() } },
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement).getByRole('region', { name: 'Sign-in notice' })
    await expect(notice).toHaveTextContent('Sign-ins from the earlier Argo app do not carry over.')
    await userEvent.click(within(notice).getByRole('button', { name: 'Connect an Account' }))
    await expect(args.notice?.onConnect).toHaveBeenCalled()
    await userEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    await expect(args.notice?.onDismiss).toHaveBeenCalled()
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
    view: ticketsView({ tickets: longBacklog(200), hasMore: true, onLoadMore: fn() }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('All open · 200+ Tickets')).toBeInTheDocument()
    const scroll = canvasElement.querySelector<HTMLElement>('[data-slot="ticket-list-scroll"]')
    if (scroll === null) throw new Error('The Ticket list needs its virtual scroll container.')
    // The DOM contains the viewport and its overscan, not every Ticket in the backlog.
    await waitFor(() => expect(scroll.querySelectorAll('li[data-index]').length).toBeLessThan(200))
    // Scrolling the list alone, as a wheel does; scrollIntoView would also scroll the panels around it.
    // Each retry scrolls again: a scroll before the list has laid out reaches no end. The
    // virtual range reports on a later frame, which a loaded CI runner can hold past 1 s.
    await waitFor(
      () => {
        scroll.scrollTop = scroll.scrollHeight
        fireEvent.scroll(scroll)
        expect(args.view.kind === 'tickets' && args.view.backlog.onLoadMore).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )
  },
}

export const LoadingMoreTickets: Story = {
  args: {
    view: ticketsView({ tickets: [standalone()], hasMore: true, loadingMore: true }),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Reading more Tickets' }),
    ).toBeVisible()
  },
}

// GitHub answers the search and counts every match, not only the page read so far.
export const SearchResults: Story = {
  args: {
    view: ticketsView({ tickets: [standalone()], query: 'wayfinder', total: 12, hasMore: true }),
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
