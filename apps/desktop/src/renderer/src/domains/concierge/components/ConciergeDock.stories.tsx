import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { OrbState } from '../eclipseOrb/types'
import { ConciergeDock } from './ConciergeDock'

/**
 * The roster's Concierge dock (issue 134 slot): a mini eclipse orb (no mountain plate), the label,
 * the current state word. `active` gates the loop — only true when the big stage is covered, so at
 * most one orb animates. Rendered on a panel-toned frame so the transparent orb canvas reads right.
 */
const ORB_STATES: OrbState[] = ['idle', 'listening', 'thinking', 'speaking', 'error']

const meta = {
  title: 'Concierge/ConciergeDock',
  component: ConciergeDock,
  args: { orbState: 'idle', active: true },
  argTypes: {
    orbState: { control: 'select', options: ORB_STATES },
    active: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="w-64 rounded-xl border border-border bg-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConciergeDock>

export default meta
type Story = StoryObj<typeof meta>

/** Interactive — flip `orbState` from the Controls panel to drive the mini orb + state word. */
export const Playground: Story = {}

const stateStory = (orbState: OrbState): Story => ({
  args: { orbState, active: true },
  play: async ({ canvasElement }) => {
    const dock = within(canvasElement).getByTestId('concierge-dock')
    await expect(dock).toHaveAttribute('data-orb-state', orbState)
    // The state word is the accessible readout — the orb canvas itself is aria-hidden.
    await expect(within(dock).getByText(orbState)).toBeInTheDocument()
  },
})

export const Idle: Story = stateStory('idle')
export const Listening: Story = stateStory('listening')
export const Thinking: Story = stateStory('thinking')
export const Speaking: Story = stateStory('speaking')
export const ErrorState: Story = { ...stateStory('error'), name: 'Error' }

/** Inactive — the big stage owns the animation, so the dock orb holds a static frame. */
export const Inactive: Story = {
  args: { orbState: 'idle', active: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Concierge')).toBeInTheDocument()
  },
}
