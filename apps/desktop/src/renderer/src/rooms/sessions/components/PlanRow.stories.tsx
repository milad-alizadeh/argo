import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { namedPlan } from '../__fixtures__/runtimeTree'
import { PlanRow } from './PlanRow'

const ENTRIES = namedPlan([
  ['completed', 'Read the legacy auth module'],
  ['completed', 'Extract the rotation core'],
  ['in_progress', 'Wire verify() onto it'],
  ['pending', 'Add middleware tests'],
])

const meta = {
  title: 'Sessions/Activity/PlanRow',
  component: PlanRow,
  args: { plan: { entries: ENTRIES } },
  argTypes: { plan: { control: false, table: { type: { summary: 'Plan' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanRow>

export default meta
type Story = StoryObj<typeof meta>

/** The plan as it stood where the turn revised it: the count, and the step it moved onto. */
export const InProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('plan 2 of 4')).toBeInTheDocument()
    await expect(canvas.getByText('· Wire verify() onto it')).toBeInTheDocument()
  },
}

/** Nothing started yet, so the row names the one that is NEXT — a plan with no current step still
 * says what the agent is about to do. */
export const NotStarted: Story = {
  args: { plan: { entries: ENTRIES.map((entry) => ({ ...entry, status: 'pending' as const })) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('plan 0 of 4')).toBeInTheDocument()
    await expect(canvas.getByText('· Read the legacy auth module')).toBeInTheDocument()
  },
}

/** Every entry done. No step is named: there is no next one, and naming a finished entry would read
 * as the thing the agent is on. */
export const AllDone: Story = {
  args: { plan: { entries: ENTRIES.map((entry) => ({ ...entry, status: 'completed' as const })) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('plan 4 of 4')).toBeInTheDocument()
    await expect(canvas.queryByText(/·/)).not.toBeInTheDocument()
  },
}
