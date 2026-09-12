import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { NavigationRail } from './NavigationRail'

const meta: Meta<typeof NavigationRail> = {
  title: 'Cockpit/NavigationRail',
  component: NavigationRail,
  tags: ['autodocs'],
  args: { onNavigate: fn() },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof NavigationRail>

export const Sessions: Story = {
  args: { destination: 'Sessions' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Tickets' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('Tickets')
  },
}
export const Tickets: Story = { args: { destination: 'Tickets' } }
