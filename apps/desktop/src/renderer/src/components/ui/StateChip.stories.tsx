import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { FINDING_STATES } from './findingState'
import { StateChip } from './StateChip'
import { Text } from './Text'

const meta = {
  title: 'Cockpit/StateChip',
  component: StateChip,
  args: { state: 'open' },
  argTypes: {
    state: { control: 'select', options: FINDING_STATES },
  },
} satisfies Meta<typeof StateChip>

export default meta
type Story = StoryObj<typeof meta>

// The chip reports, it never acts — the control that advances the cycle is AddressButton.
// Its word is what keeps the state legible without colour.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText('Open')
    // The word is authored in sentence case; the tag role is what uppercases it, so the
    // accessible text stays what the vocabulary spells.
    await expect(getComputedStyle(chip).textTransform).toBe('uppercase')
  },
}

// The whole state union in one frame — the visual-diff surface for the verdict tint pairs.
export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-region">
      {FINDING_STATES.map((state) => (
        <span className="flex flex-col items-center gap-gap" key={state}>
          <StateChip state={state} />
          <Text variant="meta" className="text-foreground-faint">
            {state}
          </Text>
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Open')).toBeInTheDocument()
    await expect(canvas.getByText('Addressing')).toBeInTheDocument()
    await expect(canvas.getByText('Fixed')).toBeInTheDocument()
  },
}
