import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AgentRow } from './AgentRow'
import { AGENT_STATES } from './agentState'

const meta = {
  title: 'Activity/BackgroundTasks/AgentRow',
  component: AgentRow,
  // The goal truncates against the row's width, so a roster-width frame is what the row
  // actually has to lay out inside.
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    name: 'idempotency agent',
    goal: 'audit handler idempotency keys',
    state: 'running',
    duration: '3m',
    channelId: 'a-idempotency',
  },
  argTypes: {
    name: { control: 'text' },
    goal: { control: 'text' },
    state: { control: 'select', options: AGENT_STATES },
    duration: { control: 'text' },
    channelId: { control: 'text' },
    rollupState: { control: 'select', options: AGENT_STATES },
  },
} satisfies Meta<typeof AgentRow>

export default meta
type Story = StoryObj<typeof meta>

// A lone row has no rollup above it, so it always words its own state, and the row's one
// state hue sits on that word.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('running')).toBeInTheDocument()
    await expect(canvas.getByText('3m')).toBeInTheDocument()
    // the seam above keys console selection off this attribute
    await expect(canvasElement.querySelector('[data-channel-id="a-idempotency"]')).toBeVisible()
    // a goal longer than the row truncates rather than pushing the meta unit off the right
    // edge — which is what keeps the duration column straight
    const goal = canvas.getByText('audit handler idempotency keys')
    await expect(goal).toHaveClass('truncate')
  },
}

// A queued Agent has not started, so it has no duration to report yet — the trailing meta
// unit shrinks to the word alone.
export const WithoutDuration: Story = {
  args: { name: 'races agent', goal: 'find retry/ack races', state: 'queued', duration: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('queued')).toBeInTheDocument()
    await expect(canvas.queryByText('3m')).not.toBeInTheDocument()
  },
}

// Inside a group the phase already reports the rollup, so a member that only repeats it
// drops its word and leaves the duration standing alone.
export const SuppressedByRollup: Story = {
  args: {
    name: 'queue agent',
    goal: 'map the retry call sites',
    state: 'done',
    rollupState: 'done',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('done')).not.toBeInTheDocument()
    await expect(canvas.getByText('3m')).toBeInTheDocument()
  },
}

// The same rollup cannot silence a row that disagrees with it — that is exactly where the
// word informs.
export const InformativeAgainstRollup: Story = {
  args: {
    name: 'semantics agent',
    goal: 'retry-once vs at-least-once',
    state: 'done',
    rollupState: 'running',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('done')).toBeInTheDocument()
  },
}

// Every state in one frame — the visual-diff surface for the word and its hue. Each row is
// lone, so none of them suppresses its word.
export const EveryState: Story = {
  render: (args) => (
    <div className="flex flex-col">
      {AGENT_STATES.map((state) => (
        <AgentRow
          key={state}
          {...args}
          state={state}
          channelId={`a-${state}`}
          name={`${state} agent`}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const state of AGENT_STATES) {
      await expect(canvas.getByText(state)).toBeInTheDocument()
    }
  },
}
