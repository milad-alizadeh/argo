import type { Meta, StoryObj } from '@storybook/react'

import { SessionsView } from './SessionsView'

const meta: Meta<typeof SessionsView> = {
  title: 'Sessions/SessionsView',
  component: SessionsView,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionsView>

export const Loading: Story = {
  args: { sessions: null, selectedSessionId: null, feed: null, error: null, onSelect: () => undefined },
}

export const Empty: Story = {
  args: { sessions: [], selectedSessionId: null, feed: null, error: null, onSelect: () => undefined },
}

export const Failure: Story = {
  args: { sessions: null, selectedSessionId: null, feed: null, error: 'Unable to list sessions.', onSelect: () => undefined },
}
