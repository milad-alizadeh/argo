import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FeedAnchor } from './FeedAnchor'
import { Text } from './Text'

const meta = {
  title: 'Shared/FeedAnchor',
  component: FeedAnchor,
  args: {
    anchor: 'quiet:c1',
    children: (
      <Text variant="code" className="text-foreground-soft">
        read 3 · searched 1
      </Text>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedAnchor>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A row the navigation list can land on. It renders nothing of its own — its whole job is to wear the
 * one spelling of the anchor attribute, so the scroll-spy and the jump name the same places the feed
 * drew. A folded run of twelve reads is ONE of these, which is what keeps the two panes agreeing about
 * what a step is.
 */
export const Anchored: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-spy="quiet:c1"]')).toBeInTheDocument()
    await expect(within(canvasElement).getByText('read 3 · searched 1')).toBeInTheDocument()
  },
}
