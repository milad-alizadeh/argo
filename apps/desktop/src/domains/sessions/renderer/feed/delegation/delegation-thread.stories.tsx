// Compact Feed rows cover a live start, reply, and interrupted Subagent run without cards.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DelegationEvent } from './delegation-event'

type Row = Parameters<typeof DelegationEvent>[0]['row']

const RESPONDED_ROW: Row = {
  shape: 'subagent',
  id: 'review:responded',
  subagentId: 'call-review',
  event: 'responded',
  state: 'completed',
  name: 'spec_review',
  text: 'The specification covers every visible state.',
  durationMs: 157_000,
  tokens: 18_400,
}

const meta: Meta<typeof DelegationEvent> = {
  title: 'Sessions/Feed/Delegation',
  component: DelegationEvent,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="max-w-(--size-session-column) bg-background p-snug">
      <DelegationEvent {...args} />
    </div>
  ),
}

export default meta
type Story = StoryObj<typeof DelegationEvent>

export const Started: Story = {
  args: {
    onOpen: fn(),
    row: { ...RESPONDED_ROW, event: 'started', state: undefined, text: undefined },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review started/ })).toBeVisible()
    await expect(canvas.queryByText('The specification covers every visible state.')).toBeNull()
    await expect(canvasElement.querySelector('.bg-card')).toBeNull()
  },
}

export const Responded: Story = {
  args: { onOpen: fn(), row: RESPONDED_ROW },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Spec review responded/ }))
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
  },
}

export const Stopped: Story = {
  args: { onOpen: fn(), row: { ...RESPONDED_ROW, state: 'interrupted', text: undefined } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review stopped/ })).toBeVisible()
    await expect(canvasElement.querySelector('.bg-warn')).not.toBeNull()
  },
}

export const NotClickable: Story = {
  args: { row: RESPONDED_ROW },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
