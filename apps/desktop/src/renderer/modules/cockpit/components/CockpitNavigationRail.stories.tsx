import type { Meta, StoryObj } from '@storybook/react'

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

export const Sessions: Story = {}
