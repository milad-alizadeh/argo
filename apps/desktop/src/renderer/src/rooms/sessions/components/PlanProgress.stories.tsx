import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { planEntries } from '../__fixtures__/runtimeTree'
import { PlanProgress } from './PlanProgress'

const meta = {
  title: 'Sessions/Activity/PlanProgress',
  component: PlanProgress,
  args: {
    plan: {
      done: 2,
      total: 4,
      entries: planEntries('completed', 'completed', 'in_progress', 'pending'),
    },
  },
  argTypes: { plan: { control: false, table: { type: { summary: 'PlanProgressModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-96 bg-panel p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanProgress>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The agent's own to-do list, with every entry status in one frame: done entries dim, the one in
 * flight breathes, the rest wait. The `N of M` is arithmetic over those statuses rather than a
 * second claim beside them.
 */
export const Plan: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The SAME section header Subagents and Timeline wear — label and count as two elements, not one
    // sentence, so every section of the pane opens identically.
    await expect(canvas.getByText('Plan')).toBeInTheDocument()
    await expect(canvas.getByText('2 of 4')).toBeInTheDocument()
    await expect(within(canvas.getByRole('list')).getAllByRole('listitem')).toHaveLength(4)
  },
}
