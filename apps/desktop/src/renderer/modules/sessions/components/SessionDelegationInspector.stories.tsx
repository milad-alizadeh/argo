import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { sessionDelegation } from '../session-fixtures'
import type { SessionFeed } from '../types'
import { SessionDelegationInspector } from './SessionDelegationInspector'

// A fixed clock, so every duration these stories draw is the same on every run.
const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const DELEGATION = sessionDelegation({
  id: 'call-review',
  label: 'Interface review',
  startedAt: '2026-09-02T08:00:00.000Z',
})

const FEED = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'subagent-feed',
  sessionId: 'composer-review',
  chainId: 'composer-review#call-review',
  revision: 'subagent-feed-1',
  rows: [
    {
      shape: 'prose',
      id: 'brief',
      role: 'user',
      text: 'Review the Session header against the token contract.',
    },
    {
      shape: 'prose',
      id: 'answer',
      role: 'assistant',
      text: 'The two work buttons take the control size and the meta typography role.',
    },
  ],
} satisfies SessionFeed

const meta: Meta<typeof SessionDelegationInspector> = {
  title: 'Sessions/Screen/Subagent Inspector',
  component: SessionDelegationInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-dvh w-(--size-session-popover) flex-col bg-sidebar">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionDelegationInspector>

export const RunningSubagent: Story = {
  args: {
    activeEvidenceId: null,
    delegation: DELEGATION,
    feed: FEED,
    now: NOW,
    onBack: () => {},
    onOpenEvidence: () => {},
    onOpenSession: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Interface review')).toBeVisible()
    await expect(canvas.getByText('Running · 5m 0s')).toBeVisible()
    await expect(
      canvas.getByText('The two work buttons take the control size and the meta typography role.'),
    ).toBeVisible()
  },
}

// The header's own control is the way back, and the inspector then holds the Subagent no longer.
function Pane() {
  const [picked, setPicked] = useState<string | null>(DELEGATION.id)
  if (picked === null) return <p>Nothing picked</p>
  return (
    <SessionDelegationInspector
      activeEvidenceId={null}
      delegation={DELEGATION}
      feed={FEED}
      now={NOW}
      onBack={() => setPicked(null)}
      onOpenEvidence={() => {}}
      onOpenSession={() => {}}
    />
  )
}

export const GoesBack: Story = {
  render: () => <Pane />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(canvas.getByText('Nothing picked')).toBeVisible()
  },
}

// The first read has not landed yet, so the pane states the Subagent and draws no document.
export const StillReading: Story = {
  args: { ...RunningSubagent.args, feed: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Interface review')).toBeVisible()
    await expect(canvasElement.querySelector('.feed__document')).toBeNull()
  },
}
