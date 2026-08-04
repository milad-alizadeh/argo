import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { interiorOf, RUNNING } from '../__fixtures__/interior'
import { AgentFeed } from './AgentFeed'

const { delegated, own } = interiorOf(RUNNING).activity
const subagent = delegated.find((item) => item.kind === 'subagent')
// The LAST own item: the feed runs oldest-first, so the live turn is at the bottom — the turn a
// reader opens the surface for, and the only one carrying both a thought and an answer.
const turn = own.at(-1)

if (subagent?.kind !== 'subagent' || turn?.kind !== 'turn') {
  throw new Error('the fixture must carry both item kinds')
}

const meta = {
  title: 'Sessions/Activity/AgentFeed',
  component: AgentFeed,
  args: { item: subagent },
  argTypes: { item: { control: false, table: { type: { summary: 'ActivityItem' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentFeed>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A subagent's live feed — what clicking a row in the fanout shows, without leaving the session. The
 * events are its own tool calls, so the detail is genuinely that agent's rather than a summary of it.
 */
export const SubagentFeed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'correctness lens' })).toBeInTheDocument()
    await expect(canvas.getByRole('list', { name: 'Subagent feed' })).toBeInTheDocument()
  },
}

/**
 * A subagent that has not started has no feed to show, and says that instead of rendering an empty
 * list — a queued agent waiting for a slot is a real state, not missing data.
 */
export const QueuedSubagent: Story = {
  args: { item: { ...subagent, events: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/no live feed yet/)).toBeInTheDocument()
  },
}

/**
 * One of this session's own turns, read as prose: the prompt that opened it, the reasoning collapsed
 * to a line, and what the agent actually said.
 *
 * No head. The quoted prompt on its rail is the seam that starts the exchange, so nothing above it
 * repeats the same sentence clipped, and the turn's number and state stay where you scan for them —
 * on the navigation row beside the feed.
 */
export const TurnSection: Story = {
  args: { item: turn },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/^Pull the token rotation/)).toBeInTheDocument()
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument()
  },
}

/**
 * A turn whose record carried no prompt opens straight on the agent's own voice. An absent prompt is
 * an absent fact — a row reading `untitled` would be prose Argo wrote standing in for prose nobody
 * typed, and the section rule above the feed still separates it from the turn before.
 */
export const TurnWithoutAPrompt: Story = {
  args: { item: { ...turn, rows: turn.rows.filter(({ kind }) => kind !== 'prompt') } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/^Pull the token rotation/)).not.toBeInTheDocument()
  },
}
