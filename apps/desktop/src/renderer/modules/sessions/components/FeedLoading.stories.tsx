import type { Meta, StoryObj } from '@storybook/react'
import '../feed/feed.css'
import { FeedLoading } from './FeedLoading'

const meta: Meta<typeof FeedLoading> = {
  title: 'Sessions/FeedLoading',
  component: FeedLoading,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof FeedLoading>

// The history is being read or measured: shadcn's status Marker with a spinner, in the place
// the Feed's first row will take.
export const Reading: Story = { args: { label: 'Reading Session…' } }
