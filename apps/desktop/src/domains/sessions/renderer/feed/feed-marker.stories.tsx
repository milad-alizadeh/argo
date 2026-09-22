import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FeedMarker } from './feed-marker'

const meta = {
  title: 'Sessions/Feed/Marker',
  component: FeedMarker,
  args: { row: { shape: 'marker', id: 'marker-1', marker: 'compacted', summary: null } },
} satisfies Meta<typeof FeedMarker>

export default meta
type Story = StoryObj<typeof meta>

export const Compacted: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Conversation compacted')).toBeInTheDocument()
  },
}

export const Interrupted: Story = {
  args: { row: { shape: 'marker', id: 'marker-2', marker: 'interrupted', summary: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Interrupted')).toBeInTheDocument()
  },
}

export const CompactedWithSummary: Story = {
  args: {
    row: {
      shape: 'marker',
      id: 'marker-3',
      marker: 'compacted',
      summary: 'The reader added a login form and wired it to the session API.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByText('Conversation compacted')
    await expect(
      canvas.queryByText('The reader added a login form and wired it to the session API.'),
    ).not.toBeInTheDocument()
    await userEvent.click(trigger)
    await expect(
      canvas.getByText('The reader added a login form and wired it to the session API.'),
    ).toBeInTheDocument()
  },
}
