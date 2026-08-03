import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TrackingCounts } from './TrackingCounts'

const meta = {
  title: 'Shell/GitControls/TrackingCounts',
  component: TrackingCounts,
  args: { ahead: 2, behind: 1 },
  argTypes: {
    ahead: { control: { type: 'range', min: 0, max: 20 } },
    behind: { control: { type: 'range', min: 0, max: 20 } },
  },
} satisfies Meta<typeof TrackingCounts>

export default meta
type Story = StoryObj<typeof meta>

/** The one place the `↑ahead ↓behind` notation is spelled, shared by the selector and every
 * branch row so the two can never drift. Drag the controls to see each count appear. */
export const Default: Story = {}

/** A branch in step with its upstream renders NOTHING — two zeroes beside a name would read as
 * state where there is none. */
export const InStep: Story = {
  args: { ahead: 0, behind: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/[↑↓]/)).not.toBeInTheDocument()
  },
}
