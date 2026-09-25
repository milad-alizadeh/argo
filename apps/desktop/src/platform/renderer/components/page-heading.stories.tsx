import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PageHeading } from './page-heading'

const meta = {
  title: 'Components/Page Heading',
  component: PageHeading,
  parameters: { layout: 'padded' },
  args: { children: 'Backlog' },
} satisfies Meta<typeof PageHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Title: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Backlog',
    )
  },
}

export const BackAction: Story = {
  args: { as: 'a', children: 'Back to Tickets', href: '#/tickets', icon: 'back', onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const action = within(canvasElement).getByRole('link', { name: 'Back to Tickets' })
    await expect(action).toHaveAttribute('href', '#/tickets')
    await expect(action.querySelector('[data-slot="icon"]')).toHaveAttribute('aria-hidden', 'true')
    action.addEventListener('click', (event) => event.preventDefault(), { once: true })
    await userEvent.click(action)
    await expect(args.onClick).toHaveBeenCalled()
  },
}
