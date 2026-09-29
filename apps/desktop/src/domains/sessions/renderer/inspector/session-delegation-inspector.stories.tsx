import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { sessionError } from '@/domains/sessions/api/session-error'
import { sessionSubagent } from '../session-fixtures'
import type { SessionFeed } from '../types'
import { SessionWorkInspectorHeader } from '../work/session-work-inspector-header'
import { SessionDelegationInspector } from './session-delegation-inspector'

// A fixed clock, so every duration these stories draw is the same on every run.
const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const DELEGATION = sessionSubagent({
  id: 'call-review',
  label: 'Interface review',
  startedAt: '2026-09-02T08:00:00.000Z',
})

const COMPLETED_DELEGATION = sessionSubagent({
  id: 'call-review',
  label: 'Interface review',
  state: 'completed',
  startedAt: '2026-09-02T08:00:00.000Z',
  endedAt: '2026-09-02T08:05:00.000Z',
})

const FAILED_DELEGATION = { ...COMPLETED_DELEGATION, state: 'failed' } satisfies typeof DELEGATION

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

// Main ends a finished Subagent's Feed with the parent's response event, its text left to the
// transcript above it.
function endedFeed(state: 'completed' | 'failed') {
  return {
    ...FEED,
    rows: [
      ...FEED.rows,
      {
        shape: 'subagent',
        id: 'call-review:response',
        subagentId: 'call-review',
        event: 'responded',
        state,
        name: 'Interface review',
      },
    ],
  } satisfies SessionFeed
}

const meta = {
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
} satisfies Meta<typeof SessionDelegationInspector>

export default meta
type Story = StoryObj<typeof SessionDelegationInspector>

function InspectorStory({
  args,
  tokens,
}: {
  args: React.ComponentProps<typeof SessionDelegationInspector>
  tokens?: number | null
}) {
  return (
    <>
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-item)">
        <SessionWorkInspectorHeader
          now={args.now}
          work={{
            kind: 'delegation',
            delegation: args.delegation,
            usage: { tokens: tokens ?? null, model: null },
          }}
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
    failure: null,
    now: NOW,
    onOpenEvidence: () => {},
    onOpenSession: () => {},
    onRetryFeed: () => {},
    sessionId: 'composer-review',
  },
  render: (args) => <InspectorStory args={args} tokens={4200} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Interface review')).toBeVisible()
    await expect(canvas.getByText('Running · 5m 0s · 4.2k tokens')).toBeVisible()
    // The delegation is running, so the last assistant row streams its text in over time rather
    // than showing the full sentence on the first render.
    await waitFor(
      () =>
        expect(canvasElement.querySelector('[data-feed-row="answer"] p')?.textContent).toBe(
          'The two work buttons take the control size and the meta typography role.',
        ),
      { timeout: 3000 },
    )
    const inspector = canvas.getByLabelText('Subagent')
    const history = canvas.getByLabelText('Subagent history')
    expect(history.getBoundingClientRect().bottom).toBe(inspector.getBoundingClientRect().bottom)
  },
}

export const LoadingSubagent: Story = {
  args: {
    activeEvidenceId: null,
    delegation: DELEGATION,
    feed: null,
    failure: null,
    onOpenEvidence: () => {},
    onOpenSession: () => {},
    onRetryFeed: () => {},
    sessionId: 'composer-review',
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText('Loading this Session')).toBeVisible(),
    )
  },
}

export const CompletedSubagent: Story = {
  args: {
    activeEvidenceId: null,
    delegation: COMPLETED_DELEGATION,
    feed: endedFeed('completed'),
    failure: null,
    onOpenEvidence: () => {},
    onOpenSession: () => {},
    onRetryFeed: () => {},
    sessionId: 'composer-review',
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('article', { name: 'Interface review sent a reply to the main Session' }),
    ).toBeVisible()
    await expect(
      canvas.getAllByText(
        'The two work buttons take the control size and the meta typography role.',
      ),
    ).toHaveLength(1)
  },
}

export const FailedSubagent: Story = {
  args: { ...CompletedSubagent.args, delegation: FAILED_DELEGATION, feed: endedFeed('failed') },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ended = canvas.getByRole('article', {
      name: 'Interface review sent a reply to the main Session',
    })
    await expect(within(ended).getByText('Failed')).toBeInTheDocument()
    await expect(canvas.getAllByRole('article', { name: /Interface review/ })).toHaveLength(1)
  },
}

// A Subagent whose Feed holds only its parent's response has no transcript to draw.
export const NoTranscript: Story = {
  args: {
    ...CompletedSubagent.args,
    feed: { ...endedFeed('completed'), rows: endedFeed('completed').rows.slice(-1) },
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No transcript found')).toBeVisible()
    await expect(canvas.queryByRole('article')).toBeNull()
  },
}

// The Harness has no history for this Subagent id.
export const MissingTranscript: Story = {
  args: {
    ...CompletedSubagent.args,
    feed: null,
    failure: sessionError('missing-session', null),
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No transcript found')).toBeVisible()
  },
}
