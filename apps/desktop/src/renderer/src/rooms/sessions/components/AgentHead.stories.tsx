import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { interiorOf, interiorOfAgent, RUNNING } from '../__fixtures__/interior'
import { AgentHead } from './AgentHead'

const meta = {
  title: 'Sessions/Activity/AgentHead',
  component: AgentHead,
  args: { agent: interiorOfAgent(RUNNING, 'correctness').activity.agent, onSelectAgent: fn() },
  argTypes: { agent: { control: false, table: { type: { summary: 'DisplayedAgentModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentHead>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A delegate's feed: whose work it is, its one state word at the right edge, the meta line of what was
 * observed, and the explicit way back. Explicit because the swap REPLACED the pane — there is no "up"
 * to scroll to.
 */
export const Delegate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'correctness lens' })).toBeInTheDocument()
    await expect(canvas.getByText(/^subagent/)).toBeInTheDocument()
    await userEvent.click(canvas.getByText('back to the session'))
    await expect(args.onSelectAgent).toHaveBeenCalledWith('root')
  },
}

/**
 * The root Agent draws NO head at all: this is the session whose plane you are inside, and a surface
 * that announces itself inside itself only adds a line to read.
 */
export const RootDrawsNothing: Story = {
  args: { agent: interiorOf(RUNNING).activity.agent },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('heading')).not.toBeInTheDocument()
  },
}
