import type { Meta, StoryObj } from '@storybook/react'
import { useEffect, useState } from 'react'
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
  args: { feed: feedStory, sessionId: feedStory.sessionId, selected: true, failure: null },
  decorators: framed,
}
// A selected Session whose transcript holds nothing yet. Nothing selected is the screen's story.
export const BlankSession: Story = {
  args: {
    feed: { ...feedStory, rows: [] },
    sessionId: feedStory.sessionId,
    selected: true,
    failure: null,
  },
  decorators: framed,
}

// A recently read deck remains mounted but hidden when the reader switches Sessions. This state
// preserves its measured document and scroll position for the return (ADR-0033 rule 4).
export const RetainedDocument: Story = {
  render: function RetainedDocumentStory() {
    const [selected, setSelected] = useState(feedStory.sessionId)
    const other = { ...feedStory, sessionId: 'other-session', revision: 'other-feed-story' }
    const feed = selected === feedStory.sessionId ? feedStory : other
    useEffect(() => {
      setSelected(other.sessionId)
    }, [other.sessionId])
    return <SessionFeed failure={null} feed={feed} selected sessionId={selected} />
  },
  decorators: framed,
}
