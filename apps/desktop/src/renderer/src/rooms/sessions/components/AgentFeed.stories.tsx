import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { interiorOf, RUNNING } from '../__fixtures__/interior'
import { AgentFeed } from './AgentFeed'

const { delegated, own } = interiorOf(RUNNING).activity
const subagent = delegated.find((item) => item.kind === 'subagent')
// The LAST own item: the feed runs oldest-first, so that is the turn in flight — the one a reader
// opens the surface for, and the only one carrying both a thought and an answer.
const turn = own.at(-1)

if (!subagent || !turn) throw new Error('the fixture must carry both item kinds')

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
 */
export const TurnSection: Story = {
  args: { item: turn },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: /^Turn \d+$/ })).toBeInTheDocument()
    await expect(canvas.getByText(/Pull the token rotation/)).toBeInTheDocument()
  },
}
