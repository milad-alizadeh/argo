import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ConciergeCaption } from './ConciergeCaption'

const meta = {
  title: 'Shell/ConciergeStrip/ConciergeCaption',
  component: ConciergeCaption,
  argTypes: { caption: { control: 'text' } },
} satisfies Meta<typeof ConciergeCaption>

export default meta
type Story = StoryObj<typeof meta>

/** A caption the Concierge is currently saying. Drag the control out past the cap to watch the
 * line truncate rather than grow — the bar's right cluster has to keep its room. */
export const Default: Story = {
  args: { caption: 'Show me where the room switch is wired.' },
  play: async ({ canvasElement }) => {
    const caption = within(canvasElement).getByText('Show me where the room switch is wired.')
    await expect(caption).toBeVisible()
  },
}

/** Silence — the Concierge's resting state, and it renders nothing at all. An empty box held
 * open for a caption that is not there would read as a bar with a hole in it. */
export const Silent: Story = {
  args: { caption: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe('')
  },
}
