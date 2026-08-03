import { type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { deliveryState, ROSTER_TONES } from '@/shared/status'
import { Status } from './Status'

// The molecule renders one derived row, so the fixtures come from the one derivation the rail
// reads rather than from words typed here.
const propsOf = (status: SessionStatus) => {
  const { word, dot } = deliveryState(sessionFacts({ status }), 'managed').rail
  return { word, tone: dot.tone }
}

// The dot is aria-hidden beside a visible word, so it has no role to address — which is the point:
// the word is the accessible name and the dot must not announce it twice.
const dotOf = (row: HTMLElement): Element => {
  const dot = row.querySelector('span')
  if (dot === null) throw new Error('the row rendered no dot')
  return dot
}

const meta = {
  title: 'Shared/Status',
  component: Status,
  argTypes: {
    word: { control: 'text' },
    tone: { control: 'select', options: ROSTER_TONES },
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
 * The registry's rule this molecule exists to honour: the dot carries the state and the word stays
 * neutral. Proving the two colours differ is what catches the tone leaking back onto the text —
 * including on the TopBar's connection chip, which passes a tone and still reads as dim text.
 */
export const NeutralWord: Story = {
  args: propsOf('permission'),
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByText('needs you')
    await expect(getComputedStyle(row).color).not.toBe(getComputedStyle(dotOf(row)).color)
  },
}

/**
 * A breathing dot: pulse belongs to the state, so anything live or asking for you carries it.
 * Asserting the computed animation, not the class, is what catches the utility failing to resolve.
 */
export const Pulsing: Story = {
  args: { ...propsOf('asking'), pulse: true },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByText('needs you')
    await expect(getComputedStyle(dotOf(row)).animationName).toBe('pulse-status')
  },
}
