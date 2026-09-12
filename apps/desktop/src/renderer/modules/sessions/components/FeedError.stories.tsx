import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { FeedError } from './FeedError'

const meta: Meta<typeof FeedError> = {
  title: 'Sessions/FeedError',
  component: FeedError,
  args: { failure: 'ENOENT: rollout.jsonl', onReread: () => undefined },
  decorators: [
    (Story) => (
      <div className="h-[420px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof FeedError>

export const UnavailableHistory: Story = {}
