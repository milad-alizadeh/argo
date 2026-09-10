import type { Meta, StoryObj } from '@storybook/react'

import { SessionList } from './SessionList'
import { sessionsStory } from './stories.fixtures'

const meta: Meta<typeof SessionList> = {
  title: 'Sessions/SessionList',
  component: SessionList,
  tags: ['autodocs'],
  args: { onSelect: () => undefined },
}

export default meta
type Story = StoryObj<typeof SessionList>

export const Populated: Story = { args: { sessions: sessionsStory, selectedSessionId: null } }
export const Selected: Story = {
  args: { sessions: sessionsStory, selectedSessionId: sessionsStory[0]?.id ?? null },
}
export const Empty: Story = { args: { sessions: [], selectedSessionId: null } }
