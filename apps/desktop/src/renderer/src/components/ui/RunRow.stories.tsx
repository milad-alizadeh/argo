import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { RUN_SHAPES, RUN_STATES, type RunMember, type RunPhase, RunRow } from './RunRow'

const batchMembers: RunMember[] = [
  {
    name: 'unit agent',
    goal: 'vitest · auth suite',
    state: 'done',
    duration: '1m 20s',
    channelId: 'a-ts-unit',
  },
  {
    name: 'e2e agent',
    goal: 'login → refresh → protected',
    state: 'done',
    duration: '2m 44s',
    channelId: 'a-ts-e2e',
  },
  {
    name: 'types agent',
    goal: 'tsc --noEmit over the tree',
    state: 'running',
    duration: '58s',
    channelId: 'a-ts-types',
  },
]

const workflowPhases: RunPhase[] = [
  { label: 'Survey', state: 'done', count: '4' },
  { label: 'Deep-read', state: 'run', count: '2/3' },
  { label: 'Synthesize', state: 'wait' },
]

const workflowMembers: RunMember[] = [
  {
    name: 'queue agent',
    phase: 'Survey',
    goal: 'map the retry call sites',
    state: 'done',
    duration: '1m 40s',
    channelId: 'a-sv1',
  },
  {
    name: 'backoff agent',
    phase: 'Survey',
    goal: 'read the backoff strategies',
    state: 'done',
    duration: '2m 05s',
    channelId: 'a-sv2',
  },
  {
    name: 'semantics agent',
    phase: 'Deep-read',
    goal: 'retry-once vs at-least-once',
    state: 'done',
    duration: '2m 30s',
    channelId: 'a-dr1',
  },
  {
    name: 'idempotency agent',
    phase: 'Deep-read',
    goal: 'audit handler idempotency keys',
    state: 'running',
    duration: '3m',
    channelId: 'a-dr2',
  },
  {
    name: 'races agent',
    phase: 'Deep-read',
    goal: 'find retry/ack races',
    state: 'queued',
    channelId: 'a-dr3',
  },
]

const meta = {
  title: 'Cockpit/RunRow',
  component: RunRow,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'test-sweep',
    shape: 'batch',
    state: 'running',
    duration: '4m',
    members: batchMembers,
    open: true,
  },
  argTypes: {
    label: { control: 'text' },
    shape: { control: 'select', options: RUN_SHAPES },
    state: { control: 'select', options: RUN_STATES },
    duration: { control: 'text' },
    open: { control: 'boolean' },
  },
} satisfies Meta<typeof RunRow>

export default meta
type Story = StoryObj<typeof meta>

// A batch lists its members flat. Expanded, the rows carry the progress, so the collapsed
// summary stays out of the header — one home per fact.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('batch')).toBeInTheDocument()
    await expect(canvas.getByText('unit agent')).toBeInTheDocument()
    await expect(canvas.queryByText('2/3 done')).not.toBeInTheDocument()
  },
}

// Collapsed, the header takes the progress back: a batch counts its done members.
export const CollapsedBatch: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2/3 done')).toBeInTheDocument()
    await expect(canvas.queryByText('unit agent')).not.toBeInTheDocument()
  },
}

// A `pipeline` Run is a **dynamic workflow** on screen — the domain word never surfaces.
// Its members group under PhaseGroups whose rails replace the batch's spine.
export const Workflow: Story = {
  args: {
    label: 'retry-audit',
    shape: 'pipeline',
    duration: '9m',
    members: workflowMembers,
    phases: workflowPhases,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('dynamic workflow')).toBeInTheDocument()
    await expect(canvas.queryByText('pipeline')).not.toBeInTheDocument()
    // done phase collapsed, active phase open, future phase header-only
    await expect(canvas.getByText('done 2/2')).toBeInTheDocument()
    await expect(canvas.getByText('idempotency agent')).toBeInTheDocument()
    await expect(canvas.queryByText('backoff agent')).not.toBeInTheDocument()
  },
}

// Collapsed, a workflow walks its phases instead of counting members — only the phase
// being worked carries a hue.
export const CollapsedWorkflow: Story = {
  args: {
    label: 'retry-audit',
    shape: 'pipeline',
    duration: '9m',
    members: workflowMembers,
    phases: workflowPhases,
    open: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // each fragment is "<phase><glyph><count>", so the walk reads Survey ✓4 → Deep-read ●2/3
    await expect(canvas.getByText(/^Survey4$/)).toBeInTheDocument()
    await expect(canvas.getByText(/^Deep-read2\/3$/)).toBeInTheDocument()
    await expect(canvas.getByText(/^Synthesize$/)).toBeInTheDocument()
    await expect(canvas.queryByText('idempotency agent')).not.toBeInTheDocument()
  },
}

// A Run's progress normally reports its state, so only failure spends a word on it.
export const Failed: Story = {
  args: { state: 'failed', open: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('failed')).toBeInTheDocument()
  },
}

// A Run still running has no final duration to report; the progress summary carries it
// alone.
export const WithoutDuration: Story = {
  args: { duration: undefined, open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2/3 done')).toBeInTheDocument()
    await expect(canvas.queryByText('4m')).not.toBeInTheDocument()
  },
}

// Every Run state in one frame, collapsed so the state word and the summary sit together.
export const EveryState: Story = {
  render: (args) => (
    <div className="flex flex-col gap-gap">
      {RUN_STATES.map((state) => (
        <RunRow key={state} {...args} state={state} label={`${state} sweep`} open={false} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('2/3 done')).toHaveLength(RUN_STATES.length)
    // running and done Runs let the progress speak; only failed adds a word
    await expect(canvas.getAllByText(/^(running|done|failed)$/)).toHaveLength(1)
  },
}
