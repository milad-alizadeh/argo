import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import { CockpitShell } from '../../../../renderer/modules/cockpit/components/cockpit-shell'
import { AccountsPanel } from '../../../accounts/renderer/components/accounts-dialog'
import { ConnectSourceFields } from '../components/connect-source-form'
import { STATUSES } from '../components/status-fixtures'
import {
  backlog,
  connection,
  engine,
  longBacklog,
  octocat,
  standalone,
  ticketsView,
} from '../components/ticket-fixtures'
import { TicketsSidebarContent } from '../components/tickets-sidebar'
import type { TicketsScreenProps } from '../hooks/use-tickets-view'
import { TicketsScreen } from './tickets-screen-view'

// The screen no longer holds its own selection (#2134: a Session's "Open Ticket" must land on the
// same Ticket after a reload), so a story stands in for the router state that owns it in the app.
function TicketsScreenStory({ view }: TicketsScreenProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    view.kind === 'tickets' ? view.selectedKey : null,
  )
  if (view.kind !== 'tickets') return <TicketsScreen view={view} />
  return (
    <TicketsScreen
      view={{
        ...view,
        selectedKey,
        onSelect: (key) => {
          view.onSelect(key)
          setSelectedKey(key)
        },
      }}
    />
  )
}

// The repository-connect form draws inline in the Accounts panel once an Account connects (#2411).
function AccountToRepositoryForm() {
  const [accountId, setAccountId] = useState<string | null>(octocat.id)
  return (
    <AccountsPanel
      connect={
        <ConnectSourceFields
          accountId={accountId}
          accounts={[octocat]}
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
      listError={null}
      listing={{ accounts: [octocat], notice: false, providers: ['github'] }}
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

const meta: Meta<typeof TicketsScreenStory> = {
  title: 'Tickets/Screen',
  component: TicketsScreenStory,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <div className="h-dvh w-full">
        <MemoryRouter>
          <CockpitShell
            sidebar={
              <TicketsSidebarContent
                connection={connection('github')}
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
type Story = StoryObj<typeof TicketsScreenStory>

async function readsTheBacklog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('All open · 3 Tickets')).toBeInTheDocument()
  const rows = canvas.getAllByRole('button', { name: /^#\d+/ })
  // A listed child sits under its parent, whatever order GitHub listed them in.
  await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual(['#607', '#609', '#273'])
  await expect(rows[0]).toHaveTextContent('Blocked by 1 open Ticket')
  await expect(rows[0]).toHaveTextContent('1 of 2 children closed')
  await expect(rows[1]).toHaveAccessibleName(/child of #607$/)
  const title = canvas.getByText('Wayfinder: the Tickets room, end to end')
  const chevron = canvas.getByRole('button', { name: 'Collapse #607' })
  const chevronIcon = chevron.querySelector('svg')
  if (chevronIcon === null) throw new Error('The Ticket fold control needs a chevron icon.')
  const titleCenter =
    title.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(title).lineHeight) / 2
  const chevronCenter =
    chevronIcon.getBoundingClientRect().top + chevronIcon.getBoundingClientRect().height / 2
  await expect(Math.abs(chevronCenter - titleCenter)).toBeLessThanOrEqual(1)
  const childRow = rows[1]?.parentElement
  if (childRow === null || childRow === undefined) throw new Error('A child Ticket needs a row.')
  const twig = childRow.querySelector('span.absolute.left-0')
  if (twig === null) throw new Error('A child Ticket needs a tree twig.')
  const childTitle = within(childRow).getByText('Prototype the Tickets room')
  const childTitleFirstLineCenter =
    childTitle.getBoundingClientRect().top +
    Number.parseFloat(getComputedStyle(childTitle).lineHeight) / 2
  await expect(
    Math.abs(twig.getBoundingClientRect().top - childTitleFirstLineCenter),
  ).toBeLessThanOrEqual(1)
  // Each row's state is an icon that opens a menu, named for a screen reader.
  await expect(canvas.getAllByRole('button', { name: 'State: Open' })).toHaveLength(3)
  await userEvent.click(rows[0] as HTMLElement)
  await expect(rows[0]).toHaveAttribute('aria-current', 'true')
}

export const Backlog: Story = {
  play: async ({ canvasElement }) => {
    await readsTheBacklog(canvasElement)
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
      onSelect: fn(),
      onOpenSession: fn(),
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
    const leafRow = rows[2]?.parentElement
    if (leafRow === null || leafRow === undefined) throw new Error('A child Ticket needs a row.')
    const twig = leafRow?.querySelector('span.absolute.left-0')
    if (twig === null || twig === undefined) throw new Error('A child Ticket needs a tree twig.')
    const title = within(leafRow).getByText('Parse the plan file')
    const titleFirstLineCenter =
      title.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(title).lineHeight) / 2
    await expect(
      Math.abs(twig.getBoundingClientRect().top - titleFirstLineCenter),
    ).toBeLessThanOrEqual(1)
  },
}

// A Linear row carries its team key and workflow status; the Detail's own stories check its priority.
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
    await expect(canvas.getByRole('button', { name: /^ENG-12/ })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Status: In Review' })).toBeVisible()
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
    // Each retry scrolls again: a scroll before the list has laid out reaches no end. The
    // IntersectionObserver reports on a later frame, which a loaded CI runner can hold past 1 s.
    await waitFor(
      () => {
        const list = canvas.getByRole('region', { name: 'Backlog' }).querySelector('ul')
        if (list) {
          list.scrollTop = list.scrollHeight
          fireEvent.scroll(list)
        }
        expect(args.view.kind === 'tickets' && args.view.backlog.onLoadMore).toHaveBeenCalled()
      },
      { timeout: 5000 },
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
