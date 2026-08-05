import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FRESH, interiorOf, WIDE_FANOUT } from '../__fixtures__/interior'
import { LONG_INTERIOR } from '../__fixtures__/longSession'
import { ActivityPane } from './ActivityPane'

const meta = {
  title: 'Sessions/Activity',
  component: ActivityPane,
  parameters: { layout: 'fullscreen' },
  args: { activity: LONG_INTERIOR.activity },
  argTypes: { activity: { control: false, table: { type: { summary: 'ActivityModel' } } } },
  decorators: [
    (Story) => (
      <div className="flex h-screen bg-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityPane>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The whole surface: the agents rail on the left, one full-width chapter feed under sticky gold
 * seams, the density gutter as the whole of navigation on the right edge.
 */
export const Surface: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The rail lists every agent, the session first — and IS the scope switcher.
    const rail = canvas.getByRole('list', { name: 'Agents' })
    await expect(within(rail).getByText('Main session')).toBeInTheDocument()
    // A turn is titled by the prompt that opened it — on the seam, and again as the minimap
    // block's hover label, which is why these are getAll.
    await expect(canvas.getAllByText('Where does the auth token get refreshed?')).not.toHaveLength(
      0,
    )
    // Opening a delegate switches the WHOLE surface to its feed — same seams, its own prompts.
    await userEvent.click(within(rail).getByText('security lens'))
    await expect(
      canvas.getAllByText('Audit the new public surface of rotation.ts.'),
    ).not.toHaveLength(0)
    // The main-session row is the way back.
    await userEvent.click(within(rail).getByText('Main session'))
    await expect(canvas.getAllByText('Where does the auth token get refreshed?')).not.toHaveLength(
      0,
    )
  },
}

/** Thirty subagents in the rail beside a live feed — the density the rail must stay scannable at. */
export const WideFanout: Story = { args: { activity: interiorOf(WIDE_FANOUT).activity } }

/**
 * A freshly spawned session has nothing to show, so the surface points at the Dock instead of
 * drawing an empty feed with a bare gutter.
 */
export const NothingObserved: Story = {
  args: { activity: interiorOf(FRESH).activity },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/the Dock below is where/)).toBeInTheDocument()
  },
}
