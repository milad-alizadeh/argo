import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import { CockpitNavigationRail } from './CockpitNavigationRail'

const meta: Meta<typeof CockpitNavigationRail> = {
  title: 'Cockpit/NavigationRail',
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
