import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CallOutput } from './CallOutput'

const LOG = Array.from({ length: 40 }, (_, line) => `[${line}] compiled module ${line}`).join('\n')

const meta = {
  title: 'Sessions/Activity/CallOutput',
  component: CallOutput,
  args: {
    output: { kind: 'output', tier: 'direct', text: '12 pass\n0 fail\n\nRan 12 tests in 1.38s' },
    defaultOpen: false,
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

/** Closed, which is what a SUCCESS gets: the command line above it already said what ran, and a
 * build log left open would bury the paragraph beside it. */
export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/Ran 12 tests/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/Ran 12 tests/)).toBeInTheDocument()
  },
}

/** Open without being asked, which is what a FAILURE gets. */
export const Open: Story = { args: { defaultOpen: true } }

/** A long log. It SCROLLS at its bound rather than being cut: a stack trace's tail is the part that
 * names the cause, and truncating from the bottom hides exactly that. */
export const LongLog: Story = {
  args: { defaultOpen: true, output: { kind: 'output', tier: 'direct', text: LOG } },
}
