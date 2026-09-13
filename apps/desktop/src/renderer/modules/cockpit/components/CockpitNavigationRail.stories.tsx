import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CockpitNavigationRail } from './CockpitNavigationRail'

const meta: Meta<typeof CockpitNavigationRail> = {
  title: 'Cockpit/Navigation Rail',
  component: CockpitNavigationRail,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof CockpitNavigationRail>

export const Sessions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sessions = canvas.getByRole('button', { name: 'Sessions' })

    await expect(sessions.querySelector('svg.lucide-messages-square')).not.toBeNull()
  },
}

export const Destinations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Tickets' }))
    await expect(canvas.getByRole('button', { name: 'Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Atlas' }))
    await expect(canvas.getByRole('button', { name: 'Atlas' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Sessions' }))
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}
