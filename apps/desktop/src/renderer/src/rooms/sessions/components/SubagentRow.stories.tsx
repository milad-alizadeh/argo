import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { groupOf, RUNNING } from '../__fixtures__/interior'
import { SubagentRow } from './SubagentRow'

const group = groupOf(RUNNING)

const meta = {
  title: 'Sessions/Activity/SubagentGroup/SubagentRow',
  component: SubagentRow,
  args: { row: group.rows[0], selected: false, onSelect: fn() },
  argTypes: { row: { control: false, table: { type: { summary: 'SubagentRowModel' } } } },
  decorators: [
    (Story) => (
      <ul className="w-96 bg-panel p-inset">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof SubagentRow>

export default meta
type Story = StoryObj<typeof meta>

/** One row: `dot · name · target · status`. Clicking it jumps the detail feed to its live feed. */
export const Row: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('correctness lens')).toBeInTheDocument()
    await expect(canvas.getByText('rotation.ts')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(args.onSelect).toHaveBeenCalledWith('subagent:correctness')
  },
}

/** Selected: an ink wash, not a fill, because the dot is already carrying this row's state. */
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-current', 'true')
  },
}

/**
 * Every status side by side. A queued subagent has no target to name yet, and a finished one holds
 * still — the dot is the whole difference, and the word beside it stays neutral.
 */
export const EveryStatus: Story = {
  render: () => (
    <>
      {group.rows.map((row) => (
        <SubagentRow key={row.key} row={row} selected={false} />
      ))}
    </>
  ),
}
