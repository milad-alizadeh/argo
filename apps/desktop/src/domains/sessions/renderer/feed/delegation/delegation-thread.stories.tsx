// Compact Feed rows cover a live start, reply, and interrupted Subagent run without cards.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
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

function FeedRow({ row, openable = true }: { row: Row; openable?: boolean }) {
  const [opened, setOpened] = useState(false)
  return (
    <div className="max-w-(--size-session-column) bg-background p-snug">
      <DelegationEvent onOpen={openable ? () => setOpened(true) : undefined} row={row} />
      <output>{opened ? 'Opened the agent inspector' : ''}</output>
    </div>
  )
}

const meta: Meta<typeof DelegationEvent> = {
  title: 'Sessions/Feed/Delegation',
  component: DelegationEvent,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof DelegationEvent>

export const Started: Story = {
  render: () => (
    <FeedRow row={{ ...RESPONDED_ROW, event: 'started', state: undefined, text: undefined }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review started/ })).toBeVisible()
    await expect(canvas.queryByText('The specification covers every visible state.')).toBeNull()
    await expect(canvasElement.querySelector('.bg-card')).toBeNull()
  },
}

export const Responded: Story = {
  render: () => <FeedRow row={RESPONDED_ROW} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Spec review responded/ }))
    await expect(canvas.getByText('Opened the agent inspector')).toBeVisible()
  },
}

export const Stopped: Story = {
  render: () => <FeedRow row={{ ...RESPONDED_ROW, state: 'interrupted', text: undefined }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review stopped/ })).toBeVisible()
    await expect(canvasElement.querySelector('.bg-warn')).not.toBeNull()
  },
}

export const NotClickable: Story = {
  render: () => <FeedRow openable={false} row={RESPONDED_ROW} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
