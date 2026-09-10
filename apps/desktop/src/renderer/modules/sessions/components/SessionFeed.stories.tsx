import type { Meta, StoryObj } from '@storybook/react'

import { feedStory } from './stories.fixtures'
import { SessionFeed } from './SessionFeed'

const meta: Meta<typeof SessionFeed> = {
  title: 'Sessions/SessionFeed',
  component: SessionFeed,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionFeed>

export const Populated: Story = { args: { feed: feedStory, error: null } }
