import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CallOutput } from './CallOutput'

const LOG = Array.from({ length: 40 }, (_, line) => `[${line}] compiled module ${line}`).join('\n')

const meta = {
  title: 'Sessions/Activity/CallOutput',
  component: CallOutput,
  args: {
    output: { kind: 'output', tier: 'direct', text: '12 pass\n0 fail\n\nRan 12 tests in 1.38s' },
  },
  argTypes: { output: { control: false, table: { type: { summary: 'OutputResult' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallOutput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The block itself. WHETHER it is shown is not this component's question — the toggle rides the
 * row's head, and `ToolRow` owns the state the two share. See `CallRow` for the pair together.
 */
export const Printed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Ran 12 tests/)).toBeInTheDocument()
  },
}

/** A long log. It SCROLLS at its bound rather than being cut: a stack trace's tail is the part that
 * names the cause, and truncating from the bottom hides exactly that. */
export const LongLog: Story = {
  args: { output: { kind: 'output', tier: 'direct', text: LOG } },
}
