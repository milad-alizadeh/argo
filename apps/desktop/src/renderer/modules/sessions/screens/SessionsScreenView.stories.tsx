import type { Meta, StoryObj } from '@storybook/react'

import { SessionsScreenView } from './SessionsScreenView'

const meta: Meta<typeof SessionsScreenView> = {
  title: 'Sessions/Screens/Sessions',
  component: SessionsScreenView,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionsScreenView>

export const NoSessions: Story = {
  args: { sessions: [], selectedSessionId: null, feed: null, onSelect: () => undefined },
}
