import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { interiorOf, RUNNING } from '../__fixtures__/interior'
import { ToolCallRow } from './ToolCallRow'

const steps = interiorOf(RUNNING).activity.sections.flatMap(({ turn }) => turn.steps)

const meta = {
  title: 'Sessions/Activity/TurnTimeline/TurnRow/ToolCallRow',
  component: ToolCallRow,
  args: { step: steps[0], selected: false, onSelect: fn() },
  argTypes: { step: { control: false, table: { type: { summary: 'ToolStepModel' } } } },
  decorators: [
    (Story) => (
      <ul className="w-96 bg-panel p-inset">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof ToolCallRow>

export default meta
type Story = StoryObj<typeof meta>

/** One step: the host's own tool name and the file or command it named. */
export const Step: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onSelect).toHaveBeenCalledWith(args.step.key)
  },
}

/** Selected: the same ink wash the subagent rows take, so the two sections read as one list. */
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-current', 'true')
  },
}

/**
 * Every status side by side. The dot carries all four — a failed call burns red and holds still, a
 * pending one barely glows — and the row's text never repeats the state in words.
 */
export const EveryStatus: Story = {
  render: () => (
    <>
      {steps.map((step) => (
        <ToolCallRow key={step.key} step={step} selected={false} />
      ))}
    </>
  ),
}
