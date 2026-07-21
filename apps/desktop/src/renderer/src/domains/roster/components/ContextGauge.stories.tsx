import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ContextGauge } from './ContextGauge'

const meta = {
  title: 'Roster/ContextGauge',
  component: ContextGauge,
  // The gauge stretches to its container the way it does inside a roster row.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  // The range runs past both ends so the clamp is something you can drag into.
  argTypes: { percentage: { control: { type: 'range', min: -20, max: 140, step: 0.1 } } },
} satisfies Meta<typeof ContextGauge>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A percentage arrives from an estimate, so it is fractional here — the rounding the dial
 * cannot show is what the assertions cover.
 */
export const Default: Story = {
  args: { percentage: 63.7 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Context')).toBeInTheDocument()
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64')
    // The estimate reads as plain text — its provenance is reachable only as a tooltip.
    await expect(canvas.getByText('~64%')).toHaveAttribute(
      'title',
      'estimated from token usage ÷ model context window',
    )
  },
}
