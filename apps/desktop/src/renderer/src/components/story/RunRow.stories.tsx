import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
  title: 'Cockpit/BackgroundTasks/RunRow',
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
    defaultOpen: true,
  },
  argTypes: {
    label: { control: 'text' },
    shape: { control: 'select', options: RUN_SHAPES },
    state: { control: 'select', options: RUN_STATES },
    duration: { control: 'text' },
    defaultOpen: { control: 'boolean' },
  },
} satisfies Meta<typeof RunRow>

export default meta
type Story = StoryObj<typeof meta>

// A batch lists its members flat. Expanded, the rows carry the progress, so the collapsed
// summary stays out of the header — one home per fact. Standalone, the caret is a real
// button: keyboard operates it exactly the way a click does.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('batch')).toBeInTheDocument()
    await expect(canvas.getByText('unit agent')).toBeInTheDocument()
    await expect(canvas.queryByText('2/3 done')).not.toBeInTheDocument()

    const toggle = canvas.getByRole('button', { name: 'Collapse test-sweep' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    toggle.focus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('button', { name: 'Expand test-sweep' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(canvas.queryByText('unit agent')).not.toBeInTheDocument()
  },
}

// Collapsed, the header takes the progress back: a batch counts its done members. Clicking
// the caret is what opens it back up — members appear and the caret flips with it.
export const CollapsedBatch: Story = {
  args: { defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2/3 done')).toBeInTheDocument()
    await expect(canvas.queryByText('unit agent')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Expand test-sweep' }))
    await expect(canvas.getByRole('button', { name: 'Collapse test-sweep' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(canvas.getByText('unit agent')).toBeInTheDocument()
  },
}

// A container (#30) drives the Run directly: the caret still reports every click through
// `onOpenChange`, but never flips itself — the members stay put until the caller re-renders
// with a new `open`.
export const Controlled: Story = {
  args: { defaultOpen: undefined, open: false, onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'Expand test-sweep' })
    await userEvent.click(toggle)
    await expect(args.onOpenChange).toHaveBeenCalledWith(true)
    await expect(canvas.getByRole('button', { name: 'Expand test-sweep' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
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
    defaultOpen: false,
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

// A Run dispatched with nothing in it yet. The batch summary still reports honestly rather
// than hiding: "0/0 done" is the designed empty presentation, not a placeholder — and with
// nothing to open, the caret reserves its space instead of becoming a dead button.
export const EmptyBatch: Story = {
  args: { members: [], defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('0/0 done')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /test-sweep/ })).not.toBeInTheDocument()
  },
}

// A member whose `phase` matches no declared Phase would vanish from the tree, so the
// partition is pinned here: every member lands under exactly one Phase, and a Phase with no
// matching members still renders its header.
export const WorkflowWithUnmatchedPhase: Story = {
  args: {
    label: 'retry-audit',
    shape: 'pipeline',
    phases: workflowPhases,
    members: [
      ...workflowMembers,
      {
        name: 'stray agent',
        // 'Deep read' is not the declared 'Deep-read'
        phase: 'Deep read',
        goal: 'a phase label the Run never declared',
        state: 'running',
        channelId: 'a-stray',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the stray member is not silently folded into the nearest phase
    await expect(canvas.getByText('running 1/3')).toBeInTheDocument()
    await expect(canvas.queryByText('running 1/4')).not.toBeInTheDocument()
    await expect(canvas.queryByText('stray agent')).not.toBeInTheDocument()
  },
}

// A Phase carrying its own `open` overrides `phaseOpensByDefault` — this is the seam a
// container writes into when the user expands a finished phase or collapses the live one.
export const WorkflowWithPhaseOverride: Story = {
  args: {
    label: 'retry-audit',
    shape: 'pipeline',
    members: workflowMembers,
    phases: [
      { label: 'Survey', state: 'done', count: '4', open: true },
      { label: 'Deep-read', state: 'run', count: '2/3', open: false },
      { label: 'Synthesize', state: 'wait' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the done phase is open against its default, the worked phase closed against its own
    await expect(canvas.getByText('backoff agent')).toBeInTheDocument()
    await expect(canvas.queryByText('idempotency agent')).not.toBeInTheDocument()
  },
}

// A Run still running has no final duration to report; the progress summary carries it
// alone.
export const WithoutDuration: Story = {
  args: { duration: undefined, defaultOpen: false },
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
        <RunRow key={state} {...args} state={state} label={`${state} sweep`} defaultOpen={false} />
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
