import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { interiorOf, RUNNING } from '../__fixtures__/interior'
import { TurnTimeline } from './TurnTimeline'

const meta = {
  title: 'Sessions/Activity/TurnTimeline',
  component: TurnTimeline,
  args: { turns: interiorOf(RUNNING).activity.turns, activeKey: null, onSelect: fn() },
  argTypes: { turns: { control: false, table: { type: { summary: 'TimelineTurnModel[]' } } } },
  decorators: [
    (Story) => (
      <div className="w-md bg-panel p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TurnTimeline>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The section: its header in the Subagents group's treatment, then the turns newest first with the
 * open one leading. Nothing from the fanout appears here — a subagent is not a step of this turn.
 */
export const Timeline: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Timeline')).toBeInTheDocument()
    // Both turns are here: the open one reporting that it is running, the folded one reporting its
    // weight. Only the live turn spends its right edge on a state word.
    await expect(canvas.getByText('running')).toBeInTheDocument()
    await expect(canvas.getByText('2 tools')).toBeInTheDocument()
  },
}

/**
 * A session Argo has observed nothing from yet. This is the honest empty rather than an error, because
 * a transcript Argo could not read is an observation failure and not a work failure.
 */
export const NothingObserved: Story = {
  args: { turns: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('nothing observed yet')).toBeInTheDocument()
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()
  },
}
