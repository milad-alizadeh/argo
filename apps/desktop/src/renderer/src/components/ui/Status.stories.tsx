import { SESSION_STATES } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { RAIL_TONES, type RailStatus, SESSION_STATUS } from '@/ship'
import { Status } from './Status'

// The molecule renders the word and its tone; the icon column of the same row belongs to
// the organism around it, so the fixtures drop it rather than the props widening.
const wordAndTone = ({ word, tone }: RailStatus): Pick<RailStatus, 'tone' | 'word'> => ({
  word,
  tone,
})

const meta = {
  title: 'Cockpit/Status',
  component: Status,
  argTypes: {
    word: { control: 'text' },
    tone: { control: 'select', options: RAIL_TONES },
    pulse: { control: 'boolean' },
  },
} satisfies Meta<typeof Status>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Word and tone arrive already derived (`SESSION_STATUS` here, `railStatus()` on a real row),
 * so the molecule never spells a state itself. The dot is decorative: the visible word
 * already names the state and must not be announced twice.
 */
export const Default: Story = {
  args: wordAndTone(SESSION_STATUS.running),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Running')).toBeInTheDocument()
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
  },
}

/** The screen's ONE animation budget, spent on the row stalled on a human. */
export const Pulsing: Story = {
  args: { ...wordAndTone(SESSION_STATUS['needs-input']), pulse: true },
  play: async ({ canvasElement }) => {
    const dot = canvasElement.querySelector('span > span')
    await expect(getComputedStyle(dot as Element).animationName).toBe('pulse-status')
  },
}

/**
 * The whole Session lifecycle in one frame — the visual-diff surface for words, tones and
 * glow. Ship-flow words ("Ready to merge", "CI failing") render through the same two props.
 */
export const EveryState: Story = {
  args: wordAndTone(SESSION_STATUS.running),
  render: () => (
    <div className="flex flex-col items-start gap-gap">
      {SESSION_STATES.map((state) => (
        <Status key={state} {...wordAndTone(SESSION_STATUS[state])} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const word of ['Running', 'Needs input', 'Done', 'Failed', 'Queued', 'Orphaned']) {
      await expect(canvas.getByText(word)).toBeInTheDocument()
    }
  },
}
