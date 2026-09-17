import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
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
    // The counter is written into its element rather than rendered (#2386), so the screen is the
    // only place that says whether it still moves.
    const counter = canvasElement.querySelector('[data-slot="turn-elapsed"]')
    const first = counter?.textContent
    await expect(first).toMatch(/\d/)
    await waitFor(async () => {
      await expect(counter?.textContent).not.toBe(first)
    })
  },
}

// A live tail tool group says "Working" in its own shimmer, so the marker goes quiet. It keeps the
// height it had, so the Feed below it does not move (#2241).
export const Quiet: Story = {
  args: { silent: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('status')).toBeNull()
    const marker = canvas.getByText('Working').closest('.group\\/marker')
    await expect(marker).not.toBeVisible()
    await expect(marker?.getBoundingClientRect().height).toBeGreaterThan(0)
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
