import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ConciergeStrip } from './ConciergeStrip'

const meta = {
  title: 'Shell/ConciergeStrip',
  component: ConciergeStrip,
  argTypes: { caption: { control: 'text' } },
} satisfies Meta<typeof ConciergeStrip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The seat as the bar holds it: the orb, then the line.
 *
 * Only the composition can show that the orb keeps its box when the caption goes quiet — set
 * `caption` to `null` and the line disappears while the orb stays exactly where it was, which is
 * what stops the bar from twitching every time the Concierge stops talking.
 */
export const Default: Story = {
  args: { caption: 'Show me where the room switch is wired.' },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement)
    await expect(strip.getByText('Show me where the room switch is wired.')).toBeVisible()
  },
}
