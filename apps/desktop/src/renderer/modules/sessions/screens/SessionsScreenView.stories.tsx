import type { Meta, StoryObj } from '@storybook/react'

import { feedStory, sessionsStory } from '../components/stories.fixtures'
import { SessionsScreenView } from './SessionsScreenView'

const meta: Meta<typeof SessionsScreenView> = {
  title: 'Sessions/Screens/Sessions',
  component: SessionsScreenView,
  tags: ['autodocs'],
  args: {
    failure: null,
    feedFailure: null,
    onSelect: () => undefined,
    onReread: () => undefined,
  },
  // The screen takes its height from the surface it is given, so a story gives it one.
  decorators: [
    (Story) => (
      <div className="h-[560px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionsScreenView>

export const Reading: Story = {
  args: { sessions: sessionsStory, selectedSessionId: feedStory.sessionId, feed: feedStory },
}
export const NothingSelected: Story = {
  args: { sessions: sessionsStory, selectedSessionId: null, feed: null },
}
export const NoSessions: Story = {
  args: { sessions: [], selectedSessionId: null, feed: null },
}
