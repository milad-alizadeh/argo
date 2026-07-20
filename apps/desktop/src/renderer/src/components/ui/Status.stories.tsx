import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Status } from './Status'
import { STATUS_STATE, type StatusState } from './sessionStatus'

const STATES = Object.keys(STATUS_STATE) as StatusState[]

const meta = {
  title: 'Cockpit/Status',
  component: Status,
  argTypes: {
    state: { control: 'select', options: STATES },
    pulse: { control: 'boolean' },
  },
} satisfies Meta<typeof Status>

export default meta
type Story = StoryObj<typeof meta>

// The word comes from the status vocabulary — a caller passes a state, never a word. The
// dot is decorative: the visible word already names the state, so it must not be
// announced twice.
export const Default: Story = {
  args: { state: 'running' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Running')).toBeInTheDocument()
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
  },
}

// The screen's ONE animation budget, spent on the row that needs you.
export const Pulsing: Story = {
  args: { state: 'needs-input', pulse: true },
  play: async ({ canvasElement }) => {
    const dot = canvasElement.querySelector('span > span')
    await expect(getComputedStyle(dot as Element).animationName).toBe('pulse-status')
  },
}

// Every state in the vocabulary — the visual-diff surface for words, tones and glow.
export const AllStates: Story = {
  args: { state: 'running' },
  render: () => (
    <div className="flex flex-col items-start gap-gap">
      {STATES.map((state) => (
        <Status key={state} state={state} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Orphaned')).toBeInTheDocument()
  },
}
