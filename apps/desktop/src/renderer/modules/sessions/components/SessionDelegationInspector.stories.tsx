import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { sessionDelegation } from '../session-fixtures'
import type { SessionFeed } from '../types'
import { SessionDelegationInspector } from './SessionDelegationInspector'
import { SessionWorkInspectorHeader } from './SessionWorkInspectorHeader'

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

function InspectorStory({
  args,
}: {
  args: React.ComponentProps<typeof SessionDelegationInspector>
}) {
  return (
    <>
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-item)">
        <SessionWorkInspectorHeader
          work={{ kind: 'delegation', delegation: args.delegation }}
          now={args.now}
        />
      </header>
      <SessionDelegationInspector {...args} />
    </>
  )
}

export const RunningSubagent: Story = {
  args: {
    activeEvidenceId: null,
    delegation: DELEGATION,
    feed: FEED,
    now: NOW,
    onOpenEvidence: () => {},
    onOpenSession: () => {},
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Interface review')).toBeVisible()
    await expect(canvas.getByText('Running · 5m 0s')).toBeVisible()
    // The delegation is running, so the last assistant row streams its reveal in rather than
    // showing the full text on the first render.
    await waitFor(
      () =>
        expect(
          canvas.getByText(
            'The two work buttons take the control size and the meta typography role.',
          ),
        ).toBeVisible(),
      { timeout: 3000 },
    )
    const inspector = canvas.getByLabelText('Subagent')
    const history = canvas.getByLabelText('Session history')
    expect(history.getBoundingClientRect().bottom).toBe(inspector.getBoundingClientRect().bottom)
  },
}
