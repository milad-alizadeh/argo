import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { groupOf, RUNNING, WIDE_FANOUT } from '../__fixtures__/interior'
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
    await expect(within(canvas.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  },
}

/**
 * A labelled tree — Codex's tier. The subagents name themselves but no group, so the header counts
 * them instead of inventing a phase name.
 */
export const Labelled: Story = {
  args: { group: { ...phased, tier: 'labelled', group: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3 · 2 running')).toBeInTheDocument()
  },
}

/**
 * A bare CLI's tier: nothing but a count, and the group says out loud that no phases were reported.
 * This is the degradation contract — the cockpit never fills a tier in.
 */
export const Flat: Story = {
  args: { group: { ...phased, tier: 'flat', group: null } },
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
