import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { interiorOf, RUNNING } from '../__fixtures__/interior'
import { TurnRow } from './TurnRow'

const turns = interiorOf(RUNNING).activity.turns
const open = turns[0]
const past = turns[1]

const meta = {
  title: 'Sessions/Activity/TurnTimeline/TurnRow',
  component: TurnRow,
  args: { turn: open, activeKey: null, onSelect: fn() },
  argTypes: { turn: { control: false, table: { type: { summary: 'TimelineTurnModel' } } } },
  decorators: [
    (Story) => (
      <ul className="w-md bg-panel p-inset">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof TurnRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The open turn: expanded by default, with its plan and its steps showing, because what a session is
 * doing now is what you came to see. The compaction marker sits in front of it — this turn is the one
 * condensed history stops at.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Titled by what was asked, not by where in the session it sits — the ordinal survives beside it.
    await expect(
      canvas.getByText(/^Pull the token rotation out of the legacy auth module/),
    ).toBeInTheDocument()
    await expect(canvas.getByText('2')).toBeInTheDocument()
    await expect(canvas.getByText('running')).toBeInTheDocument()
    await expect(canvas.getByText('compacted')).toBeInTheDocument()
    await expect(canvas.getByRole('list', { name: 'Tool calls' })).toBeInTheDocument()
  },
}

/**
 * A past turn folds and reports its WEIGHT — how much work is inside it — not the reason it stopped.
 * The stop reason of finished work is the least interesting fact about it, and it would spend the
 * row's right edge saying nothing a reader came for. Unfolding is where it becomes available.
 */
export const Past: Story = {
  args: { turn: past },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('button', { expanded: false })
    await expect(canvas.getByText('2 tools')).toBeInTheDocument()
    await expect(canvas.queryByText('end_turn')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Tool calls' })).not.toBeInTheDocument()
    await userEvent.click(header)
    await expect(canvas.getByRole('list', { name: 'Tool calls' })).toBeInTheDocument()
    // Unfolded, the card has room for the reason and the summary is no longer what you need.
    await expect(canvas.getByText('end_turn')).toBeInTheDocument()
  },
}

/**
 * A stop reason the record could not name renders as `unknown` rather than being softened into
 * `end_turn` — a guessed reason would be a fabricated fact.
 */
export const UnknownStopReason: Story = {
  args: { turn: { ...past, stopReason: 'unknown' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { expanded: false }))
    await expect(canvas.getByText('unknown')).toBeInTheDocument()
  },
}

/**
 * A turn whose record carried no prompt — a chain resumed mid-turn. It keeps its ordinal and nothing
 * else: an absent prompt is an absent fact, and a title invented for it would read as a prompt that
 * was never typed.
 */
export const NoPromptInTheRecord: Story = {
  args: { turn: { ...open, promptLine: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2')).toBeInTheDocument()
    await expect(
      canvas.queryByText(/^Pull the token rotation out of the legacy auth module/),
    ).not.toBeInTheDocument()
  },
}

/**
 * A prompt longer than the card is wide truncates rather than wrapping — one card, one line — and the
 * full text stays verbatim in the feed beside it. What is dropped here is width, never words.
 */
export const LongPrompt: Story = {
  args: {
    turn: {
      ...open,
      promptLine:
        'Pull the token rotation out of the legacy auth module and wire verify() onto it, keeping the old export working for every caller that still reaches for it through the barrel',
    },
  },
}
