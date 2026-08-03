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
    await expect(canvas.getByText('running')).toBeInTheDocument()
    await expect(canvas.getByText('compacted')).toBeInTheDocument()
    await expect(canvas.getByRole('list', { name: 'Tool calls' })).toBeInTheDocument()
  },
}

/**
 * A past turn folds, and reports the stop reason the CLI gave. Clicking the header unfolds it —
 * folding is the row's own state, which is the one thing this tier adds over its children.
 */
export const Past: Story = {
  args: { turn: past },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('button', { expanded: false })
    await expect(canvas.getByText('end_turn')).toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Tool calls' })).not.toBeInTheDocument()
    await userEvent.click(header)
    await expect(canvas.getByRole('list', { name: 'Tool calls' })).toBeInTheDocument()
  },
}

/**
 * A stop reason the record could not name renders as `unknown` rather than being softened into
 * `end_turn` — a guessed reason would be a fabricated fact.
 */
export const UnknownStopReason: Story = {
  args: { turn: { ...past, stopReason: 'unknown' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('unknown')).toBeInTheDocument()
  },
}
