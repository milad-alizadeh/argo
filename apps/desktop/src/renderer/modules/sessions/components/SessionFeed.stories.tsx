import type { Meta, StoryObj } from '@storybook/react'
import { SessionFeed } from './SessionFeed'
import { feedStory } from './stories.fixtures'

const meta: Meta<typeof SessionFeed> = {
  title: 'Sessions/SessionFeed',
  component: SessionFeed,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionFeed>

// The Feed measures its rows at the width it is given (ADR-0033 rule 3), so every story here is
// drawn in a box with a height of its own rather than in the autodocs' shrink-to-fit one.
const framed: Story['decorators'] = [
  (Story) => (
    <div className="h-[420px] bg-background">
      <Story />
    </div>
  ),
]

export const Populated: Story = {
  args: { feed: feedStory, selected: true, failure: null },
  decorators: framed,
}
// A selected Session whose transcript holds nothing yet. Nothing selected is the screen's story.
export const BlankSession: Story = {
  args: { feed: { ...feedStory, rows: [] }, selected: true, failure: null },
  decorators: framed,
}
