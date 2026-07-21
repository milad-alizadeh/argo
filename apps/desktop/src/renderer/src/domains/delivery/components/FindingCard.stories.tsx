import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FindingCard } from './FindingCard'
import { FINDING_SEVERITIES, FINDING_STATES } from './findingState'

const meta = {
  title: 'Delivery/FileDiff/FindingCard',
  component: FindingCard,
  args: {
    severity: 'blocking',
    state: 'open',
    line: 118,
    body: 'The legacy path drops the audience claim when it falls back to the old token format.',
    by: 'argo · code-review',
    onAdvanceState: fn(),
  },
  argTypes: {
    severity: { control: 'select', options: FINDING_SEVERITIES },
    state: { control: 'select', options: FINDING_STATES },
    walkFocus: { control: 'boolean' },
    line: { control: 'number' },
    body: { control: 'text' },
    by: { control: 'text' },
  },
} satisfies Meta<typeof FindingCard>

export default meta
type Story = StoryObj<typeof meta>

/** Open, blocking — the verdict-block rail and wash, chip reads Open. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('blocking')).toBeInTheDocument()
    await expect(canvas.getByText(':118')).toBeInTheDocument()
    await expect(canvas.getByText('Open')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Address' }))
    await expect(args.onAdvanceState).toHaveBeenCalled()
  },
}

/** Dispatched — the chip and control both move to the next rung of the cycle. */
export const Addressing: Story = {
  args: { state: 'addressing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Addressing')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Mark fixed' })).toBeInTheDocument()
  },
}

/** Fixed collapses the full body to a one-line stub — the control becomes Reopen. */
export const Fixed: Story = {
  args: { state: 'fixed' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Fixed')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Reopen' })).toBeInTheDocument()
    await expect(canvas.getByText(/^fixed · /)).toBeInTheDocument()
    await expect(
      canvas.queryByText(
        'The legacy path drops the audience claim when it falls back to the old token format.',
      ),
    ).not.toBeInTheDocument()
  },
}

/** Advisory swaps the rail, wash and glyph for the changes tint. */
export const Advisory: Story = {
  args: { severity: 'advisory' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('advisory')).toBeInTheDocument()
  },
}

/** Highlighted after a jump from the Review tab's walk-through — always the block tint,
 * independent of the finding's own severity. */
export const WalkFocused: Story = {
  args: { severity: 'advisory', walkFocus: true },
}
