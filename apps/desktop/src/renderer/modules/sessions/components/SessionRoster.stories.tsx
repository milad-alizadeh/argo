import type { Meta, StoryObj } from '@storybook/react'

import { SessionRoster } from './SessionRoster'

const meta: Meta<typeof SessionRoster> = {
  title: 'Sessions/SessionRoster',
  component: SessionRoster,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionRoster>

export const Empty: Story = {
  args: { sessions: [], selectedSessionId: null, onSelect: () => undefined },
}
