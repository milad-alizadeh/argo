import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import { TicketDetail } from './TicketDetail'
import { wayfinder } from './ticket-fixtures'

const URL_BODY = `See https://github.com/octocat/hello-world/blob/main/${'deeply-nested-'.repeat(12)}path.md`

const meta: Meta<typeof TicketDetail> = {
  title: 'Tickets/Ticket detail',
  component: TicketDetail,
  decorators: [
    (Story) => (
      <div style={{ width: 285 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof TicketDetail>

// GitHub bodies carry long URLs; the pane wraps them rather than scrolling sideways.
export const LongContent: Story = {
  args: {
    ticket: { ...wayfinder, title: `Wayfinder${'_without_a_break'.repeat(6)}`, body: URL_BODY },
  },
  play: async ({ canvasElement }) => {
    const article = within(canvasElement).getByRole('article', { name: 'Ticket #607' })
    await expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth)
    await expect(within(article).getAllByText('Open')[0]).toBeVisible()
  },
}
