import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  FLAT_FANOUT,
  groupOf,
  LABELLED_FANOUT,
  MIXED_PHASES,
  RUNNING,
  WIDE_FANOUT,
} from '../__fixtures__/interior'
import { SubagentGroup } from './SubagentGroup'

const phased = groupOf(RUNNING)

const meta = {
  title: 'Sessions/Activity/SubagentGroup',
  component: SubagentGroup,
  args: { group: phased, activeKey: phased.rows[0]?.key ?? null, onSelect: fn() },
  argTypes: { group: { control: false, table: { type: { summary: 'SubagentGroupModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-md bg-panel p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubagentGroup>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The phased blueprint — Claude Code's tier. The group's own name (`Verify`) shows because the CLI
 * reported one, and the header wears the same treatment the Timeline's does: two sections, one style.
 */
export const Phased: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Subagents')).toBeInTheDocument()
    await expect(canvas.getByText('Verify · 2 running')).toBeInTheDocument()
    await expect(within(canvas.getByRole('list')).getAllByRole('listitem')).toHaveLength(4)
    // Only the FINISHED delegate names a cost: a running one's spend arrives with its result, and a
    // figure before then would be a number the record never carried.
    await expect(canvas.getByText('86.3K')).toBeInTheDocument()
    await expect(canvas.getByText('4 minutes')).toBeInTheDocument()
  },
}

/**
 * A labelled tree — Codex's tier. The subagents name themselves but no group, so the header counts
 * them instead of inventing a phase name.
 */
export const Labelled: Story = {
  args: { group: groupOf(LABELLED_FANOUT), activeKey: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('4 · 2 running')).toBeInTheDocument()
    // Said for this tier too: only the note separates "reported no phases" from "phases we did not
    // draw". What distinguishes it from a bare CLI is the row names, which the rows carry.
    await expect(canvas.getByText('this CLI reported no phases')).toBeInTheDocument()
  },
}

/**
 * Two phases at once — the case the tier gating exists for. Naming the first over rows that mostly
 * belong to the other would be an invented fact, so the header counts them and each row's own phase
 * reaches its detail head instead.
 */
export const MixedPhases: Story = {
  args: { group: groupOf(MIXED_PHASES), activeKey: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('5 · 2 running')).toBeInTheDocument()
    await expect(canvas.queryByText(/Verify ·/)).not.toBeInTheDocument()
  },
}

/**
 * A bare CLI's tier: nothing but a count, and the group says out loud that no phases were reported.
 * This is the degradation contract — the cockpit never fills a tier in.
 */
export const Flat: Story = {
  args: { group: groupOf(FLAT_FANOUT), activeKey: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('this CLI reported no phases')).toBeInTheDocument()
  },
}

/**
 * Thirty subagents in one group. This is the reading the shape exists for: dense rows stay scannable
 * at a fanout a card grid dies at, and the group still collapses to one line.
 */
export const WideFanout: Story = {
  args: { group: groupOf(WIDE_FANOUT), activeKey: null },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list')
    await expect(within(list).getAllByRole('listitem')).toHaveLength(30)
  },
}
