import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { SessionFeed } from './SessionFeed'
import { feedStory } from './stories.fixtures'

const meta: Meta<typeof SessionFeed> = {
  title: 'Sessions/SessionFeed',
  component: SessionFeed,
  tags: ['autodocs'],
  args: { emptyReason: null, loading: false, onReread: () => undefined },
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
  play: async ({ canvasElement }) => {
    const viewport = await within(canvasElement).findByRole('region', { name: 'Session history' })
    await expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop).toBeLessThanOrEqual(1)
  },
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
    const retained = {
      ...feedStory,
      revision: 'retained-feed-story',
      rows: Array.from({ length: 6 }, (_, copy) =>
        feedStory.rows.map((row) => ({ ...row, id: `${copy}:${row.id}` })),
      ).flat(),
    }
    const other = {
      ...feedStory,
      sessionId: 'other-session',
      chainId: 'other-session',
      revision: 'other-feed-story',
    }
    const feed = selected === retained.sessionId ? retained : other
    return (
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex gap-2 p-2">
          <button type="button" onClick={() => setSelected(other.sessionId)}>
            Open other Session
          </button>
          <button type="button" onClick={() => setSelected(retained.sessionId)}>
            Return to original Session
          </button>
        </div>
        <SessionFeed
          emptyReason={null}
          failure={null}
          feed={feed}
          loading={false}
          onReread={() => undefined}
          selected
          sessionId={selected}
        />
      </div>
    )
  },
  decorators: framed,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const original = await canvas.findByRole('region', { name: 'Session history' })
    original.scrollTop = 96
    await userEvent.click(canvas.getByRole('button', { name: 'Open other Session' }))
    await expect(
      await canvas.findByRole('region', { name: 'Session history' }),
    ).toHaveAttribute('data-session', 'other-session')
    await userEvent.click(canvas.getByRole('button', { name: 'Return to original Session' }))
    const returned = await canvas.findByRole('region', { name: 'Session history' })
    await expect(returned).toHaveAttribute('data-session', feedStory.sessionId)
    await expect(Math.round(returned.scrollTop)).toBe(96)
  },
}
