import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CockpitNavigationRail } from '@/platform/renderer/cockpit/components/cockpit-navigation-rail'

const meta = {
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
} satisfies Meta<typeof CockpitNavigationRail>

export default meta
type Story = StoryObj<typeof CockpitNavigationRail>

export const Navigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sessions = canvas.getByRole('button', { name: 'Sessions' })

    await expect(sessions.querySelector('svg.lucide-messages-square')).not.toBeNull()

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
