import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { AgentRowModel } from './AgentRow'
import { PhaseGroup } from './PhaseGroup'
import { PHASE_STATES, type PhaseState } from './phaseState'

const surveyMembers: AgentRowModel[] = [
  {
    name: 'queue agent',
    goal: 'map the retry call sites',
    state: 'done',
    duration: '1m 40s',
    channelId: 'a-sv1',
  },
  {
    name: 'backoff agent',
    goal: 'read the backoff strategies',
    state: 'done',
    duration: '2m 05s',
    channelId: 'a-sv2',
  },
]

const deepReadMembers: AgentRowModel[] = [
  {
    name: 'semantics agent',
    goal: 'retry-once vs at-least-once',
    state: 'done',
    duration: '2m 30s',
    channelId: 'a-dr1',
  },
  {
    name: 'idempotency agent',
    goal: 'audit handler idempotency keys',
    state: 'running',
    duration: '3m',
    channelId: 'a-dr2',
  },
  { name: 'races agent', goal: 'find retry/ack races', state: 'queued', channelId: 'a-dr3' },
]

const meta = {
  title: 'Cockpit/PhaseGroup',
  component: PhaseGroup,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    runId: 'retry-audit',
    label: 'Deep-read',
    state: 'run',
    members: deepReadMembers,
    open: true,
  },
  argTypes: {
    runId: { control: 'text' },
    label: { control: 'text' },
    state: { control: 'select', options: PHASE_STATES },
    open: { control: 'boolean' },
  },
} satisfies Meta<typeof PhaseGroup>

export default meta
type Story = StoryObj<typeof meta>

// The phase being worked, with mixed member states. Its rail and its inline status share
// one hue; every member disagrees with the `running` rollup or is running itself, so all
// three word themselves.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('running 1/3')).toBeInTheDocument()
    for (const word of ['done', 'running', 'queued']) {
      await expect(canvas.getByText(word)).toBeInTheDocument()
    }
  },
}

// A finished phase collapses to its header — the fraction is all that is left to say.
export const Collapsed: Story = {
  args: { label: 'Survey', state: 'done', members: surveyMembers, open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('done 2/2')).toBeInTheDocument()
    await expect(canvas.queryByText('queue agent')).not.toBeInTheDocument()
  },
}

// Opened, a done phase is where the rollup earns its keep: every member is done too, so
// none of them repeats the word and the rows collapse to name · goal · duration.
export const RollupSilencesMembers: Story = {
  args: { label: 'Survey', state: 'done', members: surveyMembers, open: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('done 2/2')).toBeInTheDocument()
    await expect(canvas.getByText('queue agent')).toBeInTheDocument()
    await expect(canvas.queryByText('done')).not.toBeInTheDocument()
  },
}

// A future phase has no members yet, so it stands on its word alone and shows no caret —
// there is nothing to open.
export const WithoutMembers: Story = {
  args: { label: 'Synthesize', state: 'wait', members: [], open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('queued')).toBeInTheDocument()
    await expect(canvas.queryByText('queued 0/0')).not.toBeInTheDocument()
    // the phase keys off both attributes together — a phase name is unique only in its Run
    await expect(canvasElement.querySelector('[data-run-id="retry-audit"]')).toBeVisible()
    await expect(canvasElement.querySelector('[data-phase="Synthesize"]')).toBeVisible()
  },
}

// Each state gets members its own domain could actually produce — a done phase has finished
// every member, a queued one has started none. Sharing one fixture would render "done 1/3",
// a finished phase with two members still outstanding.
const MEMBERS_BY_STATE: Record<PhaseState, AgentRowModel[]> = {
  done: surveyMembers,
  run: deepReadMembers,
  wait: deepReadMembers.map((member) => ({ ...member, state: 'queued', duration: undefined })),
}

// The three rails side by side — the visual-diff surface for the state hue that the rail
// and the inline status word share.
export const EveryState: Story = {
  render: (args) => (
    <div className="flex flex-col gap-gap">
      {PHASE_STATES.map((state) => (
        <PhaseGroup
          key={state}
          {...args}
          state={state}
          label={`Phase ${state}`}
          members={MEMBERS_BY_STATE[state]}
          open={false}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('done 2/2')).toBeInTheDocument()
    await expect(canvas.getByText('running 1/3')).toBeInTheDocument()
    await expect(canvas.getByText('queued 0/3')).toBeInTheDocument()
  },
}
