import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, FRESH, interiorOf, RUNNING, withIntent } from '../__fixtures__/interior'
import { SessionPlane } from './SessionPlane'
import { SPINE } from './useSpineLayout'

const LAYOUT = {
  roster: SPINE.roster.initial,
  activity: SPINE.activity.initial,
  dock: SPINE.dock.initial,
}

const meta = {
  title: 'Sessions/SessionPlane',
  component: SessionPlane,
  parameters: { layout: 'fullscreen' },
  args: {
    interior: withIntent(RUNNING),
    layout: LAYOUT,
    handlers: {
      onSelectTab: fn(),
      onResizeDock: fn(),
      onToggleDock: fn(),
      onOpenIntent: fn(),
    },
  },
  argTypes: {
    interior: { control: false, table: { type: { summary: 'SessionInteriorModel' } } },
    layout: { control: false, table: { type: { summary: 'SpineLayout' } } },
  },
  decorators: [
    (Story) => (
      <div
        className="flex h-screen w-screen bg-background p-inset"
        style={{ '--r-dock': `${LAYOUT.dock}px` }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionPlane>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The plane as one continuous glass surface: header band, the selected tab's body, the Dock beneath.
 * Everything inside is a flat column — there is no second frosted layer anywhere in it — and the tabs
 * live in the band rather than on a strip of their own.
 */
export const Activity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Auth refactor' })).toBeInTheDocument()
    // The agents rail lists the session's delegates beside the full-width feed.
    await expect(canvas.getByRole('list', { name: 'Agents' })).toBeInTheDocument()
    await expect(canvas.getByText('Bash bun run typecheck')).toBeInTheDocument()
  },
}

/**
 * Switching to Delivery keeps the header and the Dock exactly where they were — the Dock is docked
 * under BOTH tabs, which is what makes live-process state readable while you review. The review pane
 * itself is another ticket's, so the tab says what it is waiting for.
 */
export const DeliveryTab: Story = {
  args: { interior: { ...withIntent(RUNNING), tab: 'delivery' } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/the review surface lands/)).toBeInTheDocument()
    await expect(canvas.getByText('Bash bun run typecheck')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: 'Activity' }))
    await expect(args.handlers.onSelectTab).toHaveBeenCalledWith('activity')
  },
}

/**
 * A freshly spawned session: the Dock is home. Activity has nothing to show yet and points there, so
 * the first thing you can do is the thing you came to do.
 */
export const Fresh: Story = { args: { interior: interiorOf(FRESH) } }

/**
 * A session Argo only observes: empty ring, no intent chip, and a Dock replaying its transcript with
 * no prompt. Read-only awareness looks different from a session you can drive.
 */
export const Observed: Story = { args: { interior: interiorOf(EXTERNAL) } }
