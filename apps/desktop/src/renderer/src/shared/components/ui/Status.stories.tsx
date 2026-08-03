import { SESSION_STATES, type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { deliveryState, ROSTER_TONES } from '@/shared/status'
import { Status } from './Status'

// The molecule renders one derived row, so the fixtures come from the one derivation the rail
// reads rather than from words typed here.
const propsOf = (status: SessionStatus) => {
  const { word, dot } = deliveryState(sessionFacts({ status }), 'managed').rail
  return { word, tone: dot.tone, glow: dot.glow }
}

const meta = {
  title: 'Shared/Status',
  component: Status,
  argTypes: {
    word: { control: 'text' },
    tone: { control: 'select', options: ROSTER_TONES },
    hollow: { control: 'boolean' },
    glow: { control: 'boolean' },
    pulse: { control: 'boolean' },
  },
} satisfies Meta<typeof Status>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Word and tone arrive already derived, so the molecule never spells a state itself. The dot is
 * decorative: the visible word already names the state and must not be announced twice.
 */
export const Default: Story = {
  args: propsOf('running'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('running')).toBeInTheDocument()
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
  },
}

/**
 * The registry's rule this molecule exists to honour: the dot carries the state and the word
 * stays neutral. Proving the two colours differ is what catches the tone leaking back onto the
 * text.
 */
export const NeutralWord: Story = {
  args: propsOf('permission'),
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByText('needs you')
    const dot = row.querySelector('span')
    await expect(getComputedStyle(row).color).not.toBe(getComputedStyle(dot as Element).color)
  },
}

/** The screen's ONE animation budget, spent on the row stalled on a human. */
export const Pulsing: Story = {
  args: { ...propsOf('asking'), pulse: true },
  play: async ({ canvasElement }) => {
    const dot = canvasElement.querySelector('span > span')
    await expect(getComputedStyle(dot as Element).animationName).toBe('pulse-status')
  },
}

/**
 * Every word the rail can speak for a session, in one frame — the visual-diff surface for the
 * neutral word, the dot tones and the glow. `read-only` is the observed-only row, which earns
 * identity and no state word, so its dot is hollow.
 */
export const EveryState: Story = {
  args: propsOf('running'),
  render: () => {
    const observed = deliveryState(sessionFacts({}), 'external').rail
    return (
      <div className="flex flex-col items-start gap-gap">
        {SESSION_STATES.map((state) => (
          <Status key={state} {...propsOf(state)} />
        ))}
        <Status word={observed.word} tone={observed.dot.tone} hollow={observed.dot.hollow} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // `permission` and `asking` are the one attention state, so `needs you` renders twice; so
    // do `stopped` and `ended`, which fold to `failed`.
    await expect(canvas.getAllByText('needs you')).toHaveLength(2)
    await expect(canvas.getAllByText('failed')).toHaveLength(2)
    for (const word of ['running', 'idle', 'read-only']) {
      await expect(canvas.getByText(word)).toBeInTheDocument()
    }
  },
}
