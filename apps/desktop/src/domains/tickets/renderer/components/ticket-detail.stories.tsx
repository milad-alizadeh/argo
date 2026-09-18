import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { STATUSES } from './status-fixtures'
import { TicketDetail } from './ticket-detail'
import { engine, prototype, wayfinder } from './ticket-fixtures'

const URL_BODY = `See https://github.com/octocat/hello-world/blob/main/${'deeply-nested-'.repeat(12)}path.md`

const meta: Meta<typeof TicketDetail> = {
  title: 'Tickets/Ticket Detail',
  component: TicketDetail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <aside className="flex h-dvh w-(--size-ticket-inspector) flex-col bg-sidebar">
        <Story />
      </aside>
    ),
  ],
  // #609 is in the backlog and opens; the closed #388 and #12 are not, so they stay text.
  args: {
    listed: new Set(['#609']),
    linkedSessions: [],
    onOpenSession: fn(),
    onSelect: fn(),
    provider: 'github',
    statuses: STATUSES.github,
    onChangeStatus: fn(),
    onChangePriority: fn(),
  },
}

export default meta
type Story = StoryObj<typeof TicketDetail>

export const Default: Story = {
  args: { ticket: wayfinder },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    // A linked Ticket's state is an icon, and its word stays in the text.
    const children = within(article).getByRole('region', { name: 'Children · 1 of 2 closed' })
    await expect(
      within(children)
        .getByRole('heading', { name: 'Children · 1 of 2 closed' })
        .querySelector('svg'),
    ).not.toBeNull()
    const dependencies = within(article).getByRole('region', { name: 'Blocked by · 2' })
    const blockedIcon = within(dependencies)
      .getByRole('heading', { name: 'Blocked by · 2' })
      .querySelector('svg')
    if (blockedIcon === null) throw new Error('Blocked by needs a blocked mark.')
    await expect(blockedIcon).toHaveClass('text-danger')
    await expect(children).toHaveTextContent('ClosedTicket read path#388')
    await expect(within(children).queryByRole('button', { name: /#388$/ })).toBeNull()
    await userEvent.click(within(children).getByRole('button', { name: /#609$/ }))
    await expect(args.onSelect).toHaveBeenCalledWith('#609')
    const ticketLink = within(article).getByRole('link', { name: 'Open #607 in GitHub' })
    await expect(ticketLink).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/issues/607',
    )
    await expect(ticketLink).not.toHaveClass('group/button')
    const title = within(article).getByRole('heading', { name: wayfinder.title })
    const linkBounds = ticketLink.getBoundingClientRect()
    const titleBounds = title.getBoundingClientRect()
    await expect(linkBounds.top).toBeGreaterThanOrEqual(titleBounds.bottom)
    await expect(Math.abs(linkBounds.left - titleBounds.left)).toBeLessThanOrEqual(1)
    await expect(linkBounds.width).toBeLessThan(titleBounds.width)
    // GitHub keeps no priority, and names its status the Ticket's state.
    await expect(within(article).queryByText('Status')).toBeNull()
    await expect(within(article).queryByText('Priority')).toBeNull()
    // A label GitHub colours is tinted with that colour; one without a colour stays plain.
    const tint = (name: string) =>
      within(article).getByText(name).style.getPropertyValue('--ticket-label')
    await expect(tint('wayfinder')).toBe('#5319e7')
    await expect(tint('prd')).toBe('')
  },
}

// GitHub's state is open or a reason for closing, and the menu offers each one.
export const ChangeState: Story = {
  args: { ticket: wayfinder },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await userEvent.click(within(article).getByRole('button', { name: 'State: Open' }))
    // The menu draws in a portal outside the canvas.
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await expect(within(menu).getByRole('menuitemradio', { name: 'Open' })).toBeChecked()
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Closed as not planned' }),
    )
    await expect(args.onChangeStatus).toHaveBeenCalledWith(STATUSES.github[2])
  },
}

// Linear's own workflow status and priority show as properties, and its key names the link.
export const Linear: Story = {
  args: { ticket: engine, provider: 'linear', listed: new Set(), statuses: STATUSES.linear },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket ENG-12' })
    const properties = within(article).getByText('Status').closest('dl')
    await expect(properties).toHaveTextContent('StatusIn Review')
    await expect(properties).toHaveTextContent('PriorityHigh')
    await expect(within(article).queryByText('State')).toBeNull()
    await expect(within(article).getByRole('button', { name: 'Status: In Review' })).toBeVisible()
    await expect(
      within(article).getByRole('link', { name: 'Open ENG-12 in Linear' }),
    ).toHaveAttribute('href', 'https://linear.app/analytical/issue/ENG-12')
    await expect(within(article).getByRole('region', { name: 'Blocked by · 1' })).toHaveTextContent(
      'ClosedStore the refresh tokenENG-9',
    )
  },
}

// Linear's priority menu moves the Ticket to another level, in Linear's own words.
export const ChangePriority: Story = {
  args: { ticket: engine, provider: 'linear', listed: new Set(), statuses: STATUSES.linear },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket ENG-12' })
    await userEvent.click(within(article).getByRole('button', { name: 'Priority: High' }))
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu')
    await expect(within(menu).getByRole('menuitemradio', { name: 'High' })).toBeChecked()
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Urgent' }))
    await expect(args.onChangePriority).toHaveBeenCalledWith({ level: 1, label: 'Urgent' })
  },
}

// #609 has no body and GitHub gives no dependency information for it.
export const NoBody: Story = {
  args: { ticket: prototype },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #609' })
    await expect(within(article).getByText('No description.')).toBeInTheDocument()
    await expect(
      within(article).getByText('GitHub gives no dependency information for this Ticket.'),
    ).toBeInTheDocument()
  },
}

export const NothingSelected: Story = {
  args: { ticket: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Select a Ticket')).toBeVisible()
  },
}

// A long title wraps under its number, and a long URL in the body wraps rather than scrolling sideways.
export const LongContent: Story = {
  args: {
    ticket: {
      ...wayfinder,
      title:
        'Tickets list stalls on repositories with thousands of open issues when search runs before the first page arrives',
      body: URL_BODY,
    },
  },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth)
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
  args: { ticket: { ...wayfinder, body: MARKDOWN_BODY } },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(within(article).getByRole('heading', { name: 'Flow' })).toBeVisible()
    await expect(within(article).getByRole('link', { name: 'design notes' })).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/wiki',
    )
  },
}
