import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FeedSection } from './FeedSection'
import { Text } from './Text'

const meta = {
  title: 'Shared/FeedSection',
  component: FeedSection,
  args: {
    section: {
      key: 'turn:t1',
      detail: (
        <Text variant="prose" className="text-foreground-soft">
          One section of the continuous feed — whatever the surface hangs inside it.
        </Text>
      ),
    },
    // A null root measures against the VIEWPORT, which is what a story frame is. In the app this is the
    // scrolling pane, because the window is defined relative to the pane the section scrolls inside.
    root: { current: null },
  },
  argTypes: { root: { control: false, table: { type: { summary: 'RefObject<HTMLElement>' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedSection>

export default meta
type Story = StoryObj<typeof meta>

/**
 * MOUNTED: a section near the viewport draws its rows, wearing the anchor the navigation list jumps to
 * and the scroll-spy names.
 *
 * The occluded reading — a spacer of the height the rows last measured — cannot honestly be told here:
 * it is what the intersection observer decides a frame after mount, against a scroller taller than a
 * story frame. `sessions-activity--long-session` asserts that half, over forty real turns.
 */
export const Mounted: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-spy="turn:t1"]')).toBeInTheDocument()
    await expect(
      within(canvasElement).getByText(/One section of the continuous feed/),
    ).toBeVisible()
  },
}
