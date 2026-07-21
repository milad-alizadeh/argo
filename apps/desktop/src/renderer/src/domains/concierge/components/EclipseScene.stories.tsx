import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { OrbState } from '../eclipseOrb/types'
import { EclipseScene } from './EclipseScene'

/**
 * The full-screen stage. Every reactive input is a prop: `orbState` (the voice-state vocabulary),
 * `panelShift` (the parallax drift into the roster→edge gap), and `paused` (State B's render-loop
 * freeze). WebGL animates live, so there is no pixel baseline — the play tests assert the wiring
 * (the data attributes the engine is driven from), not the rendered frame.
 */
const ORB_STATES: OrbState[] = ['idle', 'listening', 'thinking', 'speaking', 'error']

const meta = {
  title: 'Concierge/EclipseScene',
  component: EclipseScene,
  parameters: { layout: 'fullscreen' },
  args: { orbState: 'idle', paused: false, panelShift: 0 },
  argTypes: {
    orbState: { control: 'select', options: ORB_STATES },
    tint: { control: 'color' },
    paused: { control: 'boolean' },
    panelShift: { control: { type: 'range', min: -400, max: 400, step: 10 } },
  },
} satisfies Meta<typeof EclipseScene>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Interactive — flip `orbState` from the Controls panel to watch the scene morph live (the
 * eclipse, thinking lens, ground beam), and drag `panelShift` to see the parallax drift. This is
 * the story to reach for when tuning the look; the fixed per-state stories below pin each frame.
 */
export const Playground: Story = {}

const stateStory = (orbState: OrbState): Story => ({
  args: { orbState },
  play: async ({ canvasElement }) => {
    const scene = within(canvasElement).getByTestId('eclipse-scene')
    await expect(scene).toHaveAttribute('data-orb-state', orbState)
  },
})

// One story per orbState — the full voice-state vocabulary, each exercised as a pure prop.
export const Idle: Story = stateStory('idle')
export const Listening: Story = stateStory('listening')
export const Thinking: Story = stateStory('thinking')
export const Speaking: Story = stateStory('speaking')
export const ErrorState: Story = { ...stateStory('error'), name: 'Error' }

/** State A — the big orb drifted into the roster→edge gap via camera parallax (live scene). */
export const CenteredInGap: Story = {
  args: { orbState: 'idle', panelShift: 150 },
  play: async ({ canvasElement }) => {
    const scene = within(canvasElement).getByTestId('eclipse-scene')
    await expect(scene).toHaveAttribute('data-paused', 'false')
  },
}

/** State B — a session detail would cover the stage, so the render loop freezes (perf contract). */
export const PausedForDetail: Story = {
  args: { orbState: 'idle', paused: true },
  play: async ({ canvasElement }) => {
    const scene = within(canvasElement).getByTestId('eclipse-scene')
    await expect(scene).toHaveAttribute('data-paused', 'true')
  },
}
