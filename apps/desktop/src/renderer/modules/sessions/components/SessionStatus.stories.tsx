import type { Meta, StoryObj } from '@storybook/react'
import { SessionStateDot, SessionStatus } from './SessionStatus'

const meta: Meta<typeof SessionStatus> = {
  title: 'Sessions/SessionStatus',
  component: SessionStatus,
  tags: ['autodocs'],
  // The dot and the word are drawn together on a row, so each story shows the pair: the dot
  // folds eight words into four inks, and only the word tells two states of one ink apart.
  render: (args) => (
    <span className="flex items-start gap-2">
      <SessionStateDot status={args.status} />
      <SessionStatus {...args} />
    </span>
  ),
}
export default meta
type Story = StoryObj<typeof SessionStatus>

// The eight statuses the domain names, and only those (CONTEXT.md L2 · Session status). A story
// for a word the model does not name would draw a state the app can never be in.
export const Starting: Story = { args: { status: 'starting' } }
export const Running: Story = { args: { status: 'running' } }
export const Permission: Story = { args: { status: 'permission' } }
export const Asking: Story = { args: { status: 'asking' } }
export const Idle: Story = { args: { status: 'idle' } }
export const Stopped: Story = { args: { status: 'stopped' } }
export const Ended: Story = { args: { status: 'ended' } }
export const Unknown: Story = { args: { status: 'unknown' } }
