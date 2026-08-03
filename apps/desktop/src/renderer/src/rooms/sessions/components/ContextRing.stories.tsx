import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ContextRing } from './ContextRing'

const meta = {
  title: 'Sessions/SessionPlane/SessionHeader/ContextRing',
  component: ContextRing,
  args: { percentage: 38 },
  argTypes: {
    percentage: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Share of the context window in use. `null` is the empty ring.',
    },
  },
} satisfies Meta<typeof ContextRing>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The estimate as the header shows it: the arc is the share, the centre reads `~n%`, and the tilde is
 * the promise that this is derived rather than measured. Drag the control to judge the arc at both
 * ends — a value past 100 or below 0 clamps rather than overflowing the ring.
 */
export const Estimated: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('~38%')).toBeInTheDocument()
    await expect(
      within(canvasElement).getByRole('img', { name: 'context 38% used (estimated)' }),
    ).toBeInTheDocument()
  },
}

/**
 * No estimate at all: the ring draws **no arc** and reads `unknown`. This is how every external
 * session renders, and it is deliberately not a full-looking empty ring — a shape that could be read
 * as "0% used" would be a claim Argo has no basis for.
 */
export const Unknown: Story = {
  args: { percentage: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('unknown')).toBeInTheDocument()
    await expect(canvas.getByText('—')).toBeInTheDocument()
    await expect(canvas.getByRole('img', { name: 'context unknown' })).toBeInTheDocument()
  },
}
