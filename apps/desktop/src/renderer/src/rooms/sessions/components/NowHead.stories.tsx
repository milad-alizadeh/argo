import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { NowHead } from './NowHead'

const meta = {
  title: 'Sessions/Dock/NowHead',
  component: NowHead,
  args: {
    now: { task: 'Edit src/auth/rotation.ts', plan: { done: 2, total: 4 }, last: null, live: true },
  },
  argTypes: { now: { control: false, table: { type: { summary: 'NowHeadModel' } } } },
} satisfies Meta<typeof NowHead>

export default meta
type Story = StoryObj<typeof meta>

/** Working: the call in flight, the plan beside it, and a dot that breathes. */
export const Working: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Edit src/auth/rotation.ts')).toBeInTheDocument()
    await expect(canvas.getByText('plan 2/4')).toBeInTheDocument()
  },
}

/**
 * At rest: nothing is in flight, so it names what the session last did rather than showing an empty
 * task. The plan is absent because a closed turn has none to report.
 */
export const AtRest: Story = {
  args: { now: { task: null, plan: null, last: 'Bash', live: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('idle · last: Bash')).toBeInTheDocument()
  },
}

/**
 * A session that has done nothing at all says so plainly. This is the fresh-session reading, where
 * the Dock is the only place anything happens yet.
 */
export const NothingYet: Story = {
  args: { now: { task: null, plan: null, last: null, live: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('ready — type to begin')).toBeInTheDocument()
  },
}
