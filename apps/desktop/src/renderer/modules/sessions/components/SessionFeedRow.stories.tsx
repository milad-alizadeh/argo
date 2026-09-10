import type { Meta, StoryObj } from '@storybook/react'
import { SessionFeedRow } from './SessionFeedRow'
import { feedRowStory } from './stories.fixtures'

const meta: Meta<typeof SessionFeedRow> = {
  title: 'Sessions/SessionFeedRow',
  component: SessionFeedRow,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionFeedRow>

export const Default: Story = { args: { row: feedRowStory } }
