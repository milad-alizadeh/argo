import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CtxGauge } from './CtxGauge'

const meta = {
  title: 'Cockpit/CtxGauge',
  component: CtxGauge,
  // The gauge stretches to its container the way it does inside a rail row.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CtxGauge>

export default meta
type Story = StoryObj<typeof meta>

const expectGauge =
  (shown: number): Story['play'] =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('CTX')).toBeInTheDocument()
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuenow', `${shown}`)
    await expect(canvas.getByText(`~${shown}%`)).toBeInTheDocument()
  }

export const Empty: Story = { args: { pct: 0 }, play: expectGauge(0) }
export const Low: Story = { args: { pct: 18 }, play: expectGauge(18) }
export const Half: Story = { args: { pct: 50 }, play: expectGauge(50) }
export const Nearly: Story = { args: { pct: 92 }, play: expectGauge(92) }
export const Full: Story = { args: { pct: 100 }, play: expectGauge(100) }

// A percentage arrives from an estimate, so it may be fractional or out of range.
export const Fractional: Story = { args: { pct: 63.7 }, play: expectGauge(64) }
export const ClampedBelow: Story = { args: { pct: -20 }, play: expectGauge(0) }
export const ClampedAbove: Story = { args: { pct: 140 }, play: expectGauge(100) }
