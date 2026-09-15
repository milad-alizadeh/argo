import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FeedLoading } from './feed-loading'
import { TurnMarker } from './turn-marker'

const meta = {
  title: 'Sessions/Feed/Turn Marker',
  component: TurnMarker,
  args: { phase: 'working', startedAt: Date.now() },
} satisfies Meta<typeof TurnMarker>

export default meta
type Story = StoryObj<typeof meta>

export const Working: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Working' })).toBeVisible()
  },
}

export const StartingSession: Story = { args: { phase: 'starting' } }

export const ResumingSession: Story = { args: { phase: 'resuming' } }

// The comet shown while a Session's Feed loads, after its reveal delay.
export const SessionLoading: Story = {
  render: () => (
    <div className="relative h-80">
      <FeedLoading state="loading" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Loading this Session' }),
    ).toBeInTheDocument()
  },
}
