import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { TicketDetail } from './TicketDetail'
import { engine, wayfinder } from './ticket-fixtures'

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
  args: { listed: new Set(['#609']), onSelect: fn(), provider: 'github' },
}

export default meta
type Story = StoryObj<typeof TicketDetail>

export const Default: Story = {
  args: { ticket: wayfinder },
  play: async ({ args, canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    // A linked Ticket's state is an icon, and its word stays in the text.
    const children = within(article).getByRole('region', { name: 'Children · 1 of 2 closed' })
    await expect(children).toHaveTextContent('ClosedTicket read path#388')
    await expect(within(children).queryByRole('button', { name: /#388$/ })).toBeNull()
    await userEvent.click(within(children).getByRole('button', { name: /#609$/ }))
    await expect(args.onSelect).toHaveBeenCalledWith('#609')
    await expect(
      within(article).getByRole('link', { name: 'Open #607 on GitHub' }),
    ).toHaveAttribute('href', 'https://github.com/octocat/hello-world/issues/607')
    // GitHub keeps no workflow status or priority, so the Detail shows open or closed alone.
    await expect(within(article).queryByText('Status')).toBeNull()
    await expect(within(article).queryByText('Priority')).toBeNull()
  },
}

// Linear's own workflow status and priority show as properties, and its key names the link.
export const Linear: Story = {
  args: { ticket: engine, provider: 'linear', listed: new Set() },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket ENG-12' })
    const properties = within(article).getByText('Status').closest('dl')
    await expect(properties).toHaveTextContent('StatusIn Review')
    await expect(properties).toHaveTextContent('PriorityHigh')
    await expect(within(article).queryByText('State')).toBeNull()
    await expect(
      within(article).getByRole('link', { name: 'Open ENG-12 on Linear' }),
    ).toHaveAttribute('href', 'https://linear.app/analytical/issue/ENG-12')
    await expect(within(article).getByRole('region', { name: 'Blocked by · 1' })).toHaveTextContent(
      'ClosedStore the refresh tokenENG-9',
    )
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
  '```mermaid',
  'flowchart LR',
  '  Backlog --> Ticket --> Session',
  '```',
].join('\n')

// A description draws as the feed draws Markdown: headings, links that open, and Mermaid diagrams.
export const MarkdownBody: Story = {
  args: { ticket: { ...wayfinder, body: MARKDOWN_BODY } },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(within(article).getByRole('heading', { name: 'Flow' })).toBeVisible()
    await expect(within(article).getByRole('link', { name: 'design notes' })).toHaveAttribute(
      'href',
      'https://github.com/octocat/hello-world/wiki',
    )
    const diagram = within(article).getByRole('figure', { name: 'Mermaid diagram' })
    await waitFor(() => expect(diagram.querySelector('svg')).not.toBeNull(), { timeout: 5000 })
    await expect(diagram).toHaveTextContent('Session')
  },
}
