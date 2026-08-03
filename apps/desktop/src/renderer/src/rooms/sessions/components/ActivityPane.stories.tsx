import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FRESH, interiorOf, RUNNING, WIDE_FANOUT } from '../__fixtures__/interior'
import { ActivityPane } from './ActivityPane'

const meta = {
  title: 'Sessions/Activity',
  component: ActivityPane,
  parameters: { layout: 'fullscreen' },
  args: { activity: interiorOf(RUNNING).activity },
  argTypes: { activity: { control: false, table: { type: { summary: 'ActivityModel' } } } },
  // The nav pane sizes off the screen-local `--c-act` its splitter drives.
  decorators: [
    (Story) => (
      <div className="flex h-screen bg-panel" style={{ '--c-act': '420px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityPane>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The whole surface: Subagents above Timeline on the left, one continuous feed on the right. This is
 * the story that proves the composition — the two sections are never merged, the feed carries a
 * section per item in the same order, and the left highlight follows the feed rather than the click.
 */
export const TwoPane: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Subagents')).toBeInTheDocument()
    await expect(canvas.getByText('Timeline')).toBeInTheDocument()
    // Clicking a nav row jumps the feed rather than swapping the pane's content out — the section was
    // already there, which is what makes the feed continuous.
    const nav = canvas.getByRole('list', { name: 'Subagents' })
    await userEvent.click(within(nav).getByText('security lens'))
    await expect(canvas.getByRole('heading', { name: 'security lens' })).toBeInTheDocument()
  },
}

/**
 * Thirty subagents beside a live turn — the density the two-pane shape exists for. The list stays
 * narrow and scannable while the detail pane fills the rest with one agent's real feed.
 */
export const WideFanout: Story = { args: { activity: interiorOf(WIDE_FANOUT).activity } }

/**
 * A freshly spawned session has nothing to show, so the surface points at the Dock instead of drawing
 * an empty two-pane with a bare gutter.
 */
export const NothingObserved: Story = {
  args: { activity: interiorOf(FRESH).activity },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/the Dock below is where/)).toBeInTheDocument()
  },
}
