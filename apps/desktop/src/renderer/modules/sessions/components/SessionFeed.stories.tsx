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

export const NoSelection: Story = { args: { feed: null, error: null } }
export const Empty: Story = { args: { feed: { rows: [] } as typeof feedStory, error: null } }
export const Populated: Story = { args: { feed: feedStory, error: null } }
export const Failure: Story = { args: { feed: null, error: 'Unable to read this session.' } }
