import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TicketDetail } from './TicketDetail'
import { wayfinder } from './ticket-fixtures'

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
  args: { listed: new Set([609]), onSelect: fn(), scope: 'octocat/hello-world' },
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
    await expect(args.onSelect).toHaveBeenCalledWith(609)
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
  },
}
