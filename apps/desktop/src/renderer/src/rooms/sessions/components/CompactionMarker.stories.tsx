import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CompactionMarker } from './CompactionMarker'

const meta = {
  title: 'Sessions/Activity/TurnTimeline/TurnRow/CompactionMarker',
  component: CompactionMarker,
  decorators: [
    (Story) => (
      <div className="w-96 bg-panel p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompactionMarker>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The seam where history was condensed, stitched across rather than opened up: the resume chain did
 * not lose the session, so the marker must not read as a gap in it.
 */
export const Marker: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('compacted')).toBeInTheDocument()
  },
}
