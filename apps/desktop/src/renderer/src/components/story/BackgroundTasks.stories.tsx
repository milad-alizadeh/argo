import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { BackgroundTasks, type RosterActor } from './BackgroundTasks'

const reviewAgent: RosterActor = {
  kind: 'agent',
  name: 'code-review agent',
  goal: 'review 41ce2f0 vs main',
  state: 'done',
  duration: '2m 10s',
  channelId: 'a-review',
}

const testSweep: RosterActor = {
  kind: 'run',
  label: 'test-sweep',
  shape: 'batch',
  state: 'done',
  duration: '4m',
  open: false,
  members: [
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
      state: 'done',
      duration: '58s',
      channelId: 'a-ts-types',
    },
  ],
}

const retryAudit: RosterActor = {
  kind: 'run',
  label: 'retry-audit',
  shape: 'pipeline',
  state: 'running',
  duration: '9m',
  open: true,
  phases: [
    { label: 'Survey', state: 'done', count: '4' },
    { label: 'Deep-read', state: 'run', count: '2/3' },
    { label: 'Synthesize', state: 'wait' },
  ],
  members: [
    {
      name: 'queue agent',
      phase: 'Survey',
      goal: 'map the retry call sites',
      state: 'done',
      duration: '1m 40s',
      channelId: 'a-sv1',
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
  ],
}

const meta = {
  title: 'Cockpit/BackgroundTasks',
  component: BackgroundTasks,
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: { actors: [reviewAgent, testSweep, retryAudit] },
} satisfies Meta<typeof BackgroundTasks>

export default meta
type Story = StoryObj<typeof meta>

// The whole roster: a lone Agent beside a collapsed batch and an expanded workflow. The
// header is the section's name alone — the state lives in the rows, never in a rollup.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Background Tasks')).toBeInTheDocument()
    await expect(canvas.getByText('code-review agent')).toBeInTheDocument()
    await expect(canvas.getByText('3/3 done')).toBeInTheDocument()
    await expect(canvas.getByText('dynamic workflow')).toBeInTheDocument()
    // the header counts nothing — no "· 3" beside the name
    await expect(canvas.queryByText(/^·\s/)).not.toBeInTheDocument()
  },
}

// A session whose only Actor is one dispatched Agent. A lone row has no rollup above it,
// so it always words its state.
export const SingleAgent: Story = {
  args: { actors: [reviewAgent] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('code-review agent')).toBeInTheDocument()
    await expect(canvas.getByText('done')).toBeInTheDocument()
  },
}

// No Actors is a designed state, not a blank card: a session that dispatched nothing has
// no Background Tasks section at all.
export const Empty: Story = {
  args: { actors: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Background Tasks')).not.toBeInTheDocument()
  },
}
