import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FeedMarker } from './FeedMarker'

const meta = {
  title: 'Sessions/Feed/Marker',
  component: FeedMarker,
  args: { row: { shape: 'marker', id: 'marker-1', marker: 'compacted' } },
} satisfies Meta<typeof FeedMarker>

export default meta
type Story = StoryObj<typeof meta>

export const Compacted: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Conversation compacted')).toBeInTheDocument()
  },
}

export const Interrupted: Story = {
  args: { row: { shape: 'marker', id: 'marker-2', marker: 'interrupted' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Interrupted')).toBeInTheDocument()
  },
}
