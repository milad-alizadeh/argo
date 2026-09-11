import type { Meta, StoryObj } from '@storybook/react'
import { NavigationRail } from './NavigationRail'

const meta: Meta<typeof NavigationRail> = {
  title: 'Cockpit/NavigationRail',
  component: NavigationRail,
  tags: ['autodocs'],
  args: { onAppearanceChange: () => undefined, onNavigate: () => undefined },
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

export const Sessions: Story = { args: { appearance: 'system', destination: 'Sessions' } }
export const Tickets: Story = { args: { appearance: 'dark', destination: 'Tickets' } }
