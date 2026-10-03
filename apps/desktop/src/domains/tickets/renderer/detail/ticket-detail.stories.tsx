import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { engine, linearPriorities, prototype, wayfinder } from '@/mocks/tickets/renderer-models'
import { ticketStatuses } from '@/mocks/tickets/scenario'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { TicketDetail } from './ticket-detail'

const URL_BODY = `See https://github.com/octocat/hello-world/blob/main/${'deeply-nested-'.repeat(12)}path.md`

const meta = {
  title: 'Features/Tickets/Ticket Detail',
  component: TicketDetail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <div className="h-dvh" style={{ width: parameters.detailWidth ?? '100%' }}>
        <AppShell
          leftHeader={<span className="type-meta text-muted-foreground">argo</span>}
          sidebar={<aside aria-label="Tickets sidebar" className="h-full bg-sidebar" />}
        >
          <Story />
        </AppShell>
      </div>
    ),
  ],
  // #609 is in the backlog and opens; the closed #388 and #12 are not, so they stay text.
  args: {
    listed: new Set(['#609']),
    linkedSessions: [],
    onBack: fn(),
    onOpenSession: fn(),
    onSelect: fn(),
    provider: 'github',
    statuses: ticketStatuses('github'),
    priorityChoices: [],
    onChangeStatus: fn(),
    onChangePriority: fn(),
  },
} satisfies Meta<typeof TicketDetail>

export default meta
type Story = StoryObj<typeof TicketDetail>

async function openRelation(article: HTMLElement, canvasElement: HTMLElement, name: string) {
  await userEvent.click(within(article).getByRole('button', { name }))
  return within(canvasElement.ownerDocument.body).findByRole('dialog')
}

export const Default: Story = {
  args: { ticket: wayfinder() },
  parameters: { detailWidth: '40rem' },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await userEvent.click(within(canvasElement).getByRole('link', { name: 'Back to Tickets' }))
    await expect(args.onBack).toHaveBeenCalled()
    // Compact metadata keeps the full relationship rows in an accessible popover.
    const children = await openRelation(article, canvasElement, '3 children')
    await expect(children).toHaveTextContent('Closed#388 - Ticket read path')
    await expect(within(children).queryByRole('button', { name: /#388$/ })).toBeNull()
    await userEvent.click(within(children).getByRole('button', { name: /Open #609/ }))
    await expect(args.onSelect).toHaveBeenCalledWith('#609')
    await userEvent.keyboard('{Escape}')
    const blockedTrigger = within(article).getByRole('button', { name: '2 blockers' })
    const blockedIcon = blockedTrigger.querySelector('svg')
    if (blockedIcon === null) throw new Error('Blocked by needs a blocked mark.')
    const dependencies = await openRelation(article, canvasElement, '2 blockers')
    await expect(dependencies).toHaveTextContent('Closed#12 - An old blocker')
    const ticketLink = within(article).getByRole('link', { name: 'Open #607 in GitHub' })
    await expect(ticketLink).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/issues/607',
    )
    // GitHub keeps no priority, and names its status the Ticket's state.
    await expect(within(article).queryByText('Status')).toBeNull()
    await expect(within(article).queryByText('Priority')).toBeNull()
    await expect(within(article).getByText('wayfinder')).toBeVisible()
    await expect(within(article).getByText('prd')).toBeVisible()
  },
}

// A compact workspace can still fit the core metadata on one row. Every pill keeps one centreline.
export const CompactMetadataAlignment: Story = {
  args: { ticket: wayfinder() },
  parameters: { detailWidth: '40rem' },
  tags: ['view-only'],
}

export const ProviderLabels: Story = {
  args: {
    ticket: {
      ...wayfinder(),
      labels: [
        { name: 'security', color: '000000' },
        { name: 'desktop', color: 'FFFFFF' },
        { name: 'regression', color: 'ff0000' },
        { name: 'triage', color: null },
        { name: 'customer-reported-accessibility-regression', color: '5319e7' },
      ],
    },
  },
  parameters: { detailWidth: '40rem' },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    if (args.ticket === null) throw new Error('Provider labels need a Ticket.')
    for (const label of args.ticket.labels) {
      await expect(within(article).getByText(label.name)).toBeVisible()
    }
  },
}

// GitHub's state is open or a reason for closing, and the menu offers each one.
export const ChangeState: Story = {
  args: { ticket: wayfinder() },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await userEvent.click(within(article).getByRole('button', { name: 'State: Open' }))
    // The menu draws in a portal outside the canvas.
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await expect(within(menu).getByRole('menuitemradio', { name: 'Open' })).toBeChecked()
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Closed as not planned' }),
    )
    await expect(args.onChangeStatus).toHaveBeenCalledWith(ticketStatuses('github')[2])
    // Choosing closes the menu even while the Ticket still reads its old value.
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull(),
    )
  },
}

// Linear's own workflow status and priority show as properties, and its key names the link.
export const Linear: Story = {
  args: {
    ticket: engine(),
    provider: 'linear',
    listed: new Set(),
    statuses: ticketStatuses('linear'),
    priorityChoices: linearPriorities(),
  },
  parameters: { detailWidth: '40rem' },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket ENG-12' })
    const properties = within(article).getByText('Status').closest('dl')
    await expect(properties).toHaveTextContent('StatusIn Review')
    await expect(properties).toHaveTextContent('StateOpen')
    await expect(properties).toHaveTextContent('PriorityHigh')
    await expect(within(article).getByRole('button', { name: 'Status: In Review' })).toBeVisible()
    await expect(
      within(article).getByRole('link', { name: 'Open ENG-12 in Linear' }),
    ).toHaveAttribute('href', 'https://linear.app/analytical/issue/ENG-12')
    const blockers = await openRelation(article, canvasElement, '1 blocker')
    await expect(blockers).toHaveTextContent('ClosedENG-9 - Store the refresh token')
  },
}

// Linear's priority menu moves the Ticket to another level, in Linear's own words.
export const ChangePriority: Story = {
  args: {
    ticket: engine(),
    provider: 'linear',
    listed: new Set(),
    statuses: ticketStatuses('linear'),
    priorityChoices: linearPriorities(),
  },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket ENG-12' })
    await userEvent.click(within(article).getByRole('button', { name: 'Priority: High' }))
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await expect(within(menu).getByRole('menuitemradio', { name: 'High' })).toBeChecked()
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Urgent' }))
    await expect(args.onChangePriority).toHaveBeenCalledWith({ level: 1, label: 'Urgent' })
    // Choosing closes the menu even while the Ticket still reads its old value.
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull(),
    )
  },
}

// #609 has no body and GitHub gives no dependency information for it.
export const NoBody: Story = {
  args: { ticket: prototype() },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #609' })
    await expect(within(article).getByText('No description.')).toBeInTheDocument()
    await expect(
      within(article).getByText('GitHub gives no dependency information for this Ticket.'),
    ).toBeInTheDocument()
  },
}

// A long title wraps under its number, and a long URL in the body wraps rather than scrolling sideways.
export const LongContent: Story = {
  args: {
    ticket: {
      ...wayfinder(),
      title:
        'Tickets list stalls on repositories with thousands of open issues when search runs before the first page arrives',
      body: URL_BODY,
    },
  },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(within(article).getAllByText('Open')[0]).toBeVisible()
    await expect(
      within(article).getByRole('link', { name: /^https:\/\/github\.com/ }),
    ).toHaveAttribute('target', '_blank')
  },
}

const MARKDOWN_BODY = [
  '## Flow',
  'Read the [design notes](https://github.com/octocat/hello-world/wiki) first.',
].join('\n')

// A description reaches the feed's own Markdown renderer; FeedMarkdown's stories check its output.
export const MarkdownBody: Story = {
  args: { ticket: { ...wayfinder(), body: MARKDOWN_BODY } },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(within(article).getByRole('heading', { name: 'Flow' })).toBeVisible()
    await expect(within(article).getByRole('link', { name: 'design notes' })).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/wiki',
    )
  },
}
