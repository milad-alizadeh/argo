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

const meta = {
  title: 'Sessions/Feed/Delegation',
  component: DelegationEvent,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="max-w-(--size-session-column) bg-background p-snug">
      <DelegationEvent {...args} />
    </div>
  ),
} satisfies Meta<typeof DelegationEvent>

export default meta
type Story = StoryObj<typeof DelegationEvent>

export const Started: Story = {
  args: {
    onOpen: fn(),
    row: {
      ...RESPONDED_ROW,
      event: 'started',
      state: undefined,
      text: undefined,
      prompt: 'Review the specification.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review started/ })).toBeVisible()
    // The prompt lives in the Subagent's own Feed, which the title opens.
    await expect(canvas.queryByText('Review the specification.')).toBeNull()
    await expect(canvas.queryByText('The specification covers every visible state.')).toBeNull()
    await expect(canvasElement.querySelector('.bg-card')).toBeNull()
  },
}

export const Messaged: Story = {
  args: {
    row: {
      ...RESPONDED_ROW,
      id: 'review:messaged',
      event: 'messaged',
      state: undefined,
      text: undefined,
      prompt: 'Also check the empty state.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('article', { name: 'Spec review received a message' }),
    ).toBeVisible()
    await expect(canvas.queryByText('Also check the empty state.')).toBeNull()
  },
}

export const Responded: Story = {
  args: { onOpen: fn(), row: RESPONDED_ROW },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('The specification covers every visible state.')).toBeNull()
    await userEvent.click(
      canvas.getByRole('button', { name: /Spec review sent a reply to the main Session/ }),
    )
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
