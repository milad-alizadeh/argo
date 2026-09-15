import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode, useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import type { SessionError, SessionFeed, SessionFeedRow } from '../types'

import { BasicFeed } from './BasicFeed'
import { RICH_MARKDOWN } from './content/feedSamples'
import { FeedJumpToLatest } from './FeedJumpToLatest'

const feed = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-feed',
  sessionId: 'prose',
  chainId: 'prose',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prose-1', role: 'assistant', text: 'The matching Session Feed.' }],
} satisfies SessionFeed

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-feed-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

const meta: Meta<typeof BasicFeed> = {
  title: 'Sessions/Feed',
  component: BasicFeed,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
  args: {
    activeEvidenceId: null,
    feed,
    failure: null,
    isRunning: false,
    onOpenEvidence: () => {},
    selectedSessionId: 'prose',
  },
}

export default meta
type Story = StoryObj<typeof BasicFeed>

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText('Session history')).toHaveAttribute(
        'data-session',
        'prose',
      ),
    )
  },
}
export const Loading: Story = {
  args: { feed: null, failure: null, selectedSessionId: 'prose' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Loading' })).toHaveAttribute(
      'data-slot',
      'spinner',
    )
  },
}
export const Empty: Story = {
  args: { feed: { ...feed, rows: [] }, failure: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('No messages')).toBeInTheDocument())
    await expect(canvas.getByText('No messages').closest('[data-slot="empty"]')).not.toBeNull()
    await expect(canvas.getByText('No messages').closest('[data-slot="empty"]')).toHaveTextContent(
      'This Session has no messages to show.',
    )
  },
}
export const Unselected: Story = {
  args: { feed: null, failure: null, selectedSessionId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Session selected')).toBeInTheDocument()
    await expect(
      canvas.getByText('No Session selected').closest('[data-slot="empty"]'),
    ).not.toBeNull()
  },
}
export const Failure: Story = {
  args: { feed: null, failure: readFailure },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveAttribute('data-slot', 'alert')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Unable to load Session')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Argo could not read these Sessions.')
  },
}

const richFeed = {
  ...feed,
  sessionId: 'rich',
  chainId: 'rich',
  revision: 'rich-one',
  rows: [
    { shape: 'prose', id: 'rich-prompt', role: 'user', text: 'Show me the **composer** check.' },
    { shape: 'prose', id: 'rich-answer', role: 'assistant', text: RICH_MARKDOWN },
  ],
} satisfies SessionFeed

function drawnRows(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-feed-row]')]
}

// Mounted rows retain their natural content height after images and code highlighting finish.
export const FormattedProse: Story = {
  args: { feed: richFeed, selectedSessionId: 'rich' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
    const [prompt, answer] = drawnRows(canvasElement)
    await expect(prompt).toHaveTextContent('Show me the **composer** check.')
    await expect(prompt?.querySelector('[data-slot="bubble"]')).toHaveAttribute(
      'data-variant',
      'muted',
    )
    await waitFor(() =>
      expect(answer?.querySelector('code[data-highlighted="true"]')).not.toBeNull(),
    )
    await waitFor(() => expect(answer?.querySelector('button[data-state="loaded"]')).not.toBeNull())
    await waitFor(() =>
      expect(within(answer as HTMLElement).getByText('Image unavailable')).toBeVisible(),
    )
    for (const row of drawnRows(canvasElement)) await expect(row.style.height).toBe('')
  },
}

const taskNotificationFeed = {
  ...feed,
  chainId: 'task-notification',
  revision: 'task-notification-one',
  sessionId: 'task-notification',
  rows: [
    {
      shape: 'prose' as const,
      id: 'task-notification-prompt',
      role: 'user' as const,
      text: 'Kick off the consolidation pass.',
    },
    {
      shape: 'command-output' as const,
      id: 'task-notification-summary',
      text: 'Agent "Consolidate stories" finished',
    },
  ],
} satisfies SessionFeed

const skillMentionFeed = {
  ...feed,
  sessionId: 'skill-mention',
  chainId: 'skill-mention',
  revision: 'skill-mention-one',
  rows: [
    {
      shape: 'prose' as const,
      id: 'skill-mention-prompt',
      role: 'user' as const,
      text: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
    },
  ],
} satisfies SessionFeed

// A background task's delivery shows only its summary line, not the raw <task-notification>
// envelope or its embedded JSON result (#2054).
export const TaskNotification: Story = {
  args: { feed: taskNotificationFeed, selectedSessionId: 'task-notification' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getByText('Agent "Consolidate stories" finished')).toBeInTheDocument(),
    )
    await expect(canvas.queryByText(/task-notification/)).toBeNull()
    await expect(canvas.queryByText(/"files"/)).toBeNull()
  },
}

const delegationFeed = {
  ...feed,
  chainId: 'delegations',
  revision: 'delegations-one',
  sessionId: 'delegations',
  rows: [
    {
      shape: 'delegation' as const,
      id: 'agent-review',
      actor: 'agent' as const,
      action: 'Review the Feed card for keyboard access.',
      status: 'running',
      progress: 'Checking focus and motion',
      groupId: 'review',
    },
    {
      shape: 'delegation-group' as const,
      id: 'delegation:build',
      actor: 'shell' as const,
      groupId: 'build',
      entries: [
        {
          shape: 'delegation' as const,
          id: 'shell-build-start',
          actor: 'shell' as const,
          action: 'Started bun run build',
          status: 'running',
          progress: null,
          groupId: 'build',
        },
        {
          shape: 'delegation' as const,
          id: 'shell-build-end',
          actor: 'shell' as const,
          action: 'Build completed',
          status: 'completed',
          progress: null,
          groupId: 'build',
        },
      ],
    },
  ],
} satisfies SessionFeed

export const DelegationCards: Story = {
  args: { feed: delegationFeed, selectedSessionId: 'delegations' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const agent = canvas.getByRole('region', { name: 'Agent delegation' })
    await expect(agent).toHaveTextContent('Review the Feed card for keyboard access.')
    await expect(agent).toHaveTextContent('running')
    const shell = canvas.getByRole('region', { name: 'Shell activity' })
    await expect(shell).toHaveTextContent('Started bun run build')
    await expect(shell).toHaveTextContent('Build completed')
    await expect(shell).toHaveTextContent('completed')
    await expect(canvasElement.querySelectorAll('[data-slot="feed-delegation"]')).toHaveLength(2)
  },
}

const commandReceipt =
  '/implement 2178 --focus feed protocol event accessibility and command grouping'

const eventFeed = {
  ...feed,
  chainId: 'events',
  revision: 'events-one',
  sessionId: 'events',
  rows: [
    { shape: 'event' as const, id: 'event-status', event: 'status' as const, text: 'running' },
    { shape: 'event' as const, id: 'event-transcript', event: 'transcript' as const, text: null },
    { shape: 'event' as const, id: 'event-context', event: 'context' as const, text: null },
    {
      shape: 'event' as const,
      id: 'event-command',
      event: 'command' as const,
      text: commandReceipt,
    },
  ],
} satisfies SessionFeed

export const ProtocolEvents: Story = {
  args: { feed: eventFeed, selectedSessionId: 'events' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Status updated')).toBeVisible()
    await expect(canvas.getByText('running')).toBeVisible()
    await expect(canvas.getByText('Transcript delivered')).toBeVisible()
    await expect(canvas.getByText('System context updated')).toBeVisible()
    await expect(canvas.getByText('Command received')).toBeVisible()
    await expect(canvas.getByText(commandReceipt)).toBeVisible()
    await expect(canvas.queryByText('<status>running</status>')).toBeNull()
    await expect(canvasElement.querySelectorAll('[data-slot="feed-event"]')).toHaveLength(4)
  },
}

// A prompt that opens with a skill mention and a link draws a badge and a clean link, not the
// raw markdown-link brackets (#2049).
export const PromptWithSkillMentionAndLink: Story = {
  args: { feed: skillMentionFeed, selectedSessionId: 'skill-mention' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(1))
    const [prompt] = drawnRows(canvasElement)
    await expect(prompt).toHaveTextContent('Implement')
    await expect(prompt).not.toHaveTextContent('[$implement]')
    await expect(
      canvas.getByRole('link', { name: 'https://github.com/milad-alizadeh/argo/issues/1944' }),
    ).toBeVisible()
  },
}

const toolFeed = {
  ...feed,
  chainId: 'tools',
  revision: 'tools-one',
  sessionId: 'tools',
  rows: [
    {
      shape: 'tool-group' as const,
      id: 'tool-group:one:two',
      label: 'Ran a command, edited a file',
      calls: [
        {
          shape: 'tool' as const,
          id: 'one',
          kind: 'command' as const,
          label: 'Ran a command',
          detail: null,
          status: 'succeeded' as const,
          evidence: {
            kind: 'output' as const,
            title: 'bun test composer',
            source: Array.from(
              { length: 48 },
              (_unused, index) => `command output ${index + 1}`,
            ).join('\n'),
          },
          text: 'bun test composer',
        },
        {
          shape: 'tool' as const,
          id: 'two',
          kind: 'edited' as const,
          label: 'Edited Composer.tsx',
          detail: '+2 −1',
          status: 'failed' as const,
          evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
          text: null,
        },
      ],
    },
  ],
} satisfies SessionFeed

export const GroupedToolCalls: Story = {
  args: { feed: toolFeed, selectedSessionId: 'tools' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Ran a command, edited a file' })
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText('command output 1')).toBeNull()
    await userEvent.click(group)
    const commandText = await canvas.findByText((_content, node) => {
      const isMatch = node?.textContent === 'bun test composer'
      const descendantHasMatch = Array.from(node?.querySelectorAll('*') ?? []).some(
        (descendant) => descendant.textContent === 'bun test composer',
      )
      const isMeasurementClone = node?.closest('[aria-hidden="true"]') !== null
      return isMatch && !descendantHasMatch && !isMeasurementClone
    })
    const call = await canvas.findByRole('button', { name: /Edited Composer.tsx/ })
    await expect(group).toHaveClass('type-body')
    await waitFor(() => expect(commandText).toBeVisible())
    const combinedCode = commandText.closest('[data-language]')
    await expect(combinedCode).toHaveTextContent('bun test composer')
    await expect(combinedCode).toHaveTextContent('command output 1')
    const visibleCodeBlocks = [...(group.closest('article')?.querySelectorAll('pre') ?? [])].filter(
      (block) => block.closest('[aria-hidden="true"]') === null,
    )
    await expect(visibleCodeBlocks).toHaveLength(1)
    const panel = commandText.closest('[data-slot="collapsible-content"]')
    await expect(panel).toHaveClass('transition-[height,opacity,transform]')
    await expect(call).toHaveClass('type-body')
    await userEvent.click(group)
    await waitFor(() => expect(canvas.queryByText('command output 1')).toBeNull())
  },
}

// commandRuns.jsonl has adjacent Claude runs; each assistant record owns a distinct Feed block.
const separateToolRunsFeed = {
  ...feed,
  chainId: 'command-runs',
  revision: 'command-runs-one',
  sessionId: 'command-runs',
  rows: [
    {
      shape: 'tool-group' as const,
      id: 'tool-group:run-one',
      label: 'Ran 2 commands',
      calls: [
        {
          shape: 'tool' as const,
          id: 'run-one-test',
          kind: 'command' as const,
          label: 'Ran bun test',
          detail: null,
          status: 'succeeded' as const,
          evidence: null,
          text: 'bun test',
        },
        {
          shape: 'tool' as const,
          id: 'run-one-types',
          kind: 'command' as const,
          label: 'Ran bun run typecheck',
          detail: null,
          status: 'succeeded' as const,
          evidence: null,
          text: 'bun run typecheck',
        },
      ],
    },
    {
      shape: 'tool-group' as const,
      id: 'tool-group:run-two',
      label: 'Ran a command',
      calls: [
        {
          shape: 'tool' as const,
          id: 'run-two-format',
          kind: 'command' as const,
          label: 'Ran bunx biome check .',
          detail: null,
          status: 'succeeded' as const,
          evidence: null,
          text: 'bunx biome check .',
        },
      ],
    },
  ],
} satisfies SessionFeed

export const SeparateToolRuns: Story = {
  args: { feed: separateToolRunsFeed, selectedSessionId: 'command-runs' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Ran 2 commands' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Ran a command' })).toBeVisible()
  },
}

const streamingFeed = {
  ...feed,
  sessionId: 'streaming',
  chainId: 'streaming',
  revision: 'streaming-one',
  rows: [
    { shape: 'prose', id: 'streaming-prompt', role: 'user', text: 'Summarise the check.' },
    { shape: 'prose', id: 'streaming-first', role: 'assistant', text: 'The check ran.' },
  ],
} satisfies SessionFeed

const streamingReply = {
  ...streamingFeed,
  revision: 'streaming-two',
  rows: [
    ...streamingFeed.rows,
    { shape: 'prose', id: 'streaming-second', role: 'assistant', text: RICH_MARKDOWN },
  ],
} satisfies SessionFeed

function StreamingFeed() {
  const [current, setCurrent] = useState<SessionFeed>(streamingFeed)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(streamingReply)}>
        Receive reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          isRunning={false}
          selectedSessionId="streaming"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
        />
      </div>
    </div>
  )
}

function drawnRow(canvasElement: HTMLElement, id: string) {
  return drawnRows(canvasElement).find((row) => row.dataset.feedRow === id)
}

// History shows at once; a reply that arrives while the Feed is open is uncovered, then its mask
// is removed.
export const StreamingReply: Story = {
  render: () => <StreamingFeed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
    for (const row of drawnRows(canvasElement)) {
      await expect(row).not.toHaveAttribute('data-revealing')
    }

    await userEvent.click(canvas.getByRole('button', { name: 'Receive reply' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'streaming-second')).toBeDefined())
    const reply = drawnRow(canvasElement, 'streaming-second') as HTMLElement
    await expect(reply).toHaveAttribute('data-revealing', 'true')
    await expect(reply.getAnimations()).toHaveLength(1)
    await expect(drawnRow(canvasElement, 'streaming-first')).not.toHaveAttribute('data-revealing')
    await waitFor(() => expect(reply.getAnimations()).toHaveLength(0), { timeout: 3000 })
    await expect(getComputedStyle(reply).maskImage).toBe('none')
  },
}

const historyRows = Array.from({ length: 36 }, (_unused, index) => ({
  shape: 'prose' as const,
  id: `history-${index}`,
  role: 'assistant' as const,
  text: `History row ${index + 1}: the reader can inspect this earlier part of the Session.`,
}))
const largeHistoryRows = Array.from({ length: 480 }, (_unused, index) => ({
  shape: 'prose' as const,
  id: `large-history-${index}`,
  role: 'assistant' as const,
  text: `Large history row ${index + 1}: only visible and overscanned rows may mount.`,
}))
const historyFeed = {
  ...feed,
  chainId: 'history',
  revision: 'history-one',
  sessionId: 'history',
  rows: historyRows,
} satisfies SessionFeed

const disclosureGroup = toolFeed.rows[0]
if (disclosureGroup === undefined) throw new RangeError('Tool Feed needs a disclosure row.')
const disclosureHistoryRows: SessionFeedRow[] = Array.from({ length: 42 }, (_unused, index) => {
  if (index === 9) return { ...disclosureGroup, id: 'history-disclosure' }
  return {
    shape: 'prose' as const,
    id: `history-disclosure-${index}`,
    role: 'assistant' as const,
    text: `History row ${index + 1}: preserves the reader's place during disclosure motion.`,
  }
})
const disclosureHistoryFeed = {
  ...historyFeed,
  chainId: 'history-disclosure',
  revision: 'history-disclosure-one',
  sessionId: 'history-disclosure',
  rows: disclosureHistoryRows,
} satisfies SessionFeed
const largeHistoryFeed = {
  ...historyFeed,
  chainId: 'large-history',
  revision: 'large-history-one',
  sessionId: 'large-history',
  rows: largeHistoryRows,
} satisfies SessionFeed

// Opening a long Session must not create a second document or mount every transcript row.
export const LargeTranscriptVirtualizesMountedRows: Story = {
  args: { feed: largeHistoryFeed, selectedSessionId: 'large-history' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByLabelText('Session history')
    await waitFor(() =>
      expect(drawnRows(canvasElement).length).toBeLessThan(largeHistoryRows.length),
    )
    await expect(canvasElement.querySelector('.feed__measured')).toBeNull()
  },
}
const updatedHistoryFeed = {
  ...historyFeed,
  revision: 'history-two',
  rows: [
    ...historyRows,
    {
      shape: 'prose' as const,
      id: 'history-streamed',
      role: 'assistant' as const,
      text: 'A streamed reply arrived while the reader was inspecting history.',
    },
  ],
} satisfies SessionFeed
const prependedHistoryFeed = {
  ...historyFeed,
  revision: 'history-with-earlier-page',
  rows: [
    {
      shape: 'prose' as const,
      id: 'history-earlier',
      role: 'assistant' as const,
      text: 'Earlier Session history arrived.',
    },
    ...historyRows,
  ],
} satisfies SessionFeed

function HistoryScrollHarness() {
  const [current, setCurrent] = useState<SessionFeed>(historyFeed)
  const [jumpToLatest, setJumpToLatest] = useState<(() => void) | null>(null)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(updatedHistoryFeed)}>
        Receive streamed reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          isRunning={false}
          onJumpToLatestChange={(_sessionId, action) => setJumpToLatest(() => action)}
          onAnswerQuestion={() => {}}
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          selectedSessionId="history"
        />
        {jumpToLatest === null ? null : (
          <FeedJumpToLatest label="Jump to latest" onClick={jumpToLatest} />
        )}
      </div>
    </div>
  )
}

function HistoryPrependHarness() {
  const [current, setCurrent] = useState<SessionFeed>(historyFeed)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(prependedHistoryFeed)}>
        Load earlier history
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          answeringQuestionId={null}
          failure={null}
          feed={current}
          isRunning={false}
          onAnswerQuestion={() => {}}
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          questionFailure={() => null}
          selectedSessionId="history"
        />
      </div>
    </div>
  )
}

function DisclosureHistoryHarness() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          answeringQuestionId={null}
          failure={null}
          feed={disclosureHistoryFeed}
          isRunning={false}
          onAnswerQuestion={() => {}}
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          questionFailure={() => null}
          selectedSessionId="history-disclosure"
        />
      </div>
    </div>
  )
}

// TanStack keeps an earlier reading position when a reply arrives, then its own scrollToEnd
// action renders the new tail. This covers the one Feed viewport controller's contract.
export const HistoryDoesNotFollowStreamingReply: Story = {
  render: () => <HistoryScrollHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(history.clientHeight))
    await expect(drawnRows(canvasElement).length).toBeLessThan(historyRows.length)
    history.scrollTop = 0
    fireEvent.scroll(history)
    await canvas.findByRole('button', { name: 'Jump to latest' })

    const scrollHeight = history.scrollHeight
    await userEvent.click(canvas.getByRole('button', { name: 'Receive streamed reply' }))
    await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(scrollHeight))
    await expect(history.scrollTop).toBe(0)
    const latest = await canvas.findByRole('button', { name: 'Jump to latest' })
    await expect(latest.querySelector('svg')).toBeVisible()
    await userEvent.click(latest)
    await waitFor(() => expect(drawnRow(canvasElement, 'history-streamed')).toBeDefined())
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Jump to latest' })).toBeNull())
  },
}
export const HistoryFollowsStreamingReplyAtLatest: Story = {
  render: () => <HistoryScrollHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByLabelText('Session history')
    await userEvent.click(canvas.getByRole('button', { name: 'Receive streamed reply' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'history-streamed')).toBeDefined())
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Jump to latest' })).toBeNull())
  },
}

export const FreshSessionLandsAtEndUnderStrictMode: Story = {
  render: () => (
    <StrictMode>
      <HistoryScrollHarness />
    </StrictMode>
  ),
  play: async ({ canvasElement }) => {
    const history = await within(canvasElement).findByLabelText('Session history')
    await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(history.clientHeight))
    await waitFor(() =>
      expect(history.scrollTop).toBeCloseTo(history.scrollHeight - history.clientHeight, 1),
    )
  },
}

export const HistoryKeepsItsAnchorWhenEarlierRowsArrive: Story = {
  render: () => <HistoryPrependHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    history.scrollTop = history.scrollHeight / 2
    fireEvent.scroll(history)
    await waitFor(() => expect(drawnRow(canvasElement, 'history-18')).toBeDefined())
    const anchoredRow = drawnRow(canvasElement, 'history-18')
    await userEvent.click(canvas.getByRole('button', { name: 'Load earlier history' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'history-18')).toBe(anchoredRow))
  },
}

export const DisclosureKeepsReaderAnchorDuringMotion: Story = {
  render: () => <DisclosureHistoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    history.scrollTop = history.scrollHeight * 0.6
    fireEvent.scroll(history)
    const group = await canvas.findByRole('button', { name: 'Ran a command, edited a file' })
    const anchor = await waitFor(() => {
      const row = drawnRow(canvasElement, 'history-disclosure-18')
      expect(row).toBeDefined()
      return row as HTMLElement
    })
    const anchorTop = anchor.getBoundingClientRect().top

    fireEvent.click(group)
    await waitFor(() => expect(group).toHaveAttribute('aria-expanded', 'true'))
    const panelId = group.getAttribute('aria-controls')
    if (panelId === null) throw new TypeError('Disclosure trigger needs a controlled panel.')
    const panel = canvasElement.ownerDocument.getElementById(panelId)
    if (!(panel instanceof HTMLElement)) throw new TypeError('Disclosure panel needs an element.')
    await waitFor(() => expect(panel.scrollHeight).toBeGreaterThan(0))
    await waitFor(() => expect(panel.getAnimations().length).toBeGreaterThan(0))
    await waitFor(() => expect(panel.getAnimations()).toHaveLength(0))
    await waitFor(() =>
      expect(Math.abs(anchor.getBoundingClientRect().top - anchorTop)).toBeLessThan(1),
    )

    fireEvent.click(group)
    await waitFor(() => expect(group).toHaveAttribute('aria-expanded', 'false'))
    await waitFor(() => expect(panel.getAnimations().length).toBeGreaterThan(0))
    await waitFor(() => expect(panel.getAnimations()).toHaveLength(0))
    await waitFor(() =>
      expect(Math.abs(anchor.getBoundingClientRect().top - anchorTop)).toBeLessThan(1),
    )
  },
}

// The play function cannot set the system's motion preference, so it answers the query itself.
function preferReducedMotion(): () => void {
  const system = window.matchMedia
  window.matchMedia = (query) =>
    query === '(prefers-reduced-motion: reduce)'
      ? ({ matches: true, media: query } as MediaQueryList)
      : system.call(window, query)
  return () => {
    window.matchMedia = system
  }
}

const stalledFeed = {
  ...feed,
  sessionId: 'stalled',
  chainId: 'stalled',
  revision: 'stalled-one',
  rows: [],
} satisfies SessionFeed

// A fixture whose Feed never settles: `rows` stays empty and `isRunning` stays true for the
// whole story, so nothing ever satisfies `feedContent`'s running condition (#2102). `stallTimeoutMs`
// stands in for the production bound so the story does not wait on the real one.
function StalledFeedHarness() {
  const [otherClicks, setOtherClicks] = useState(0)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setOtherClicks((count) => count + 1)}>
        Other window control ({otherClicks})
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={stalledFeed}
          failure={null}
          isRunning
          posture="external"
          selectedSessionId="stalled"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          stallTimeoutMs={50}
        />
      </div>
    </div>
  )
}

// Past the stall bound, the reader sees a retry action instead of an indefinite spinner, and
// nothing else in the window stops responding while it shows (#2102).
export const Stalled: Story = {
  render: () => <StalledFeedHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Could not load this Session')).toBeInTheDocument())
    await expect(canvas.getByText(/This Session is external/)).toBeInTheDocument()
    const retry = canvas.getByRole('button', { name: 'Retry' })

    const otherControl = canvas.getByRole('button', { name: /Other window control/ })
    await userEvent.click(otherControl)
    await expect(
      canvas.getByRole('button', { name: 'Other window control (1)' }),
    ).toBeInTheDocument()

    await userEvent.click(retry)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
  },
}

// A Session whose read never answers at all (no SessionFeed ever arrives, #2111's repro):
// `feed` stays null instead of arriving with empty `rows`. Retry calls `onRetryFeed`, the
// reader's hook into a fresh IPC attempt, not just the local bound.
function NeverArrivesHarness() {
  const [retries, setRetries] = useState(0)
  const [otherClicks, setOtherClicks] = useState(0)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setOtherClicks((count) => count + 1)}>
        Other window control ({otherClicks})
      </button>
      <span>Retries: {retries}</span>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={null}
          failure={null}
          isRunning={false}
          posture="external"
          selectedSessionId="never-arrives"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => setRetries((count) => count + 1)}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          stallTimeoutMs={50}
        />
      </div>
    </div>
  )
}

// The window stays live while the read is stuck (nothing else stops responding), and the reader
// gets a retry that reaches the actual read, not a reload (#2102).
export const NeverArrives: Story = {
  render: () => <NeverArrivesHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Could not load this Session')).toBeInTheDocument())
    await expect(canvas.getByText(/This Session is external/)).toBeInTheDocument()

    const otherControl = canvas.getByRole('button', { name: /Other window control/ })
    await userEvent.click(otherControl)
    await expect(
      canvas.getByRole('button', { name: 'Other window control (1)' }),
    ).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(canvas.getByText('Retries: 1')).toBeInTheDocument())
  },
}

export const StreamingReplyReducedMotion: Story = {
  render: () => <StreamingFeed />,
  play: async ({ canvasElement }) => {
    const restore = preferReducedMotion()
    try {
      await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Receive reply' }))
      await waitFor(() => expect(drawnRow(canvasElement, 'streaming-second')).toBeDefined())
      const reply = drawnRow(canvasElement, 'streaming-second') as HTMLElement
      await expect(reply.getAnimations()).toHaveLength(0)
      await expect(getComputedStyle(reply).maskImage).toBe('none')
    } finally {
      restore()
    }
  },
}

const streamingText = 'The check ran.'
const firstChunkText =
  'The check ran. The reader sees each new word at a steady pace while the response arrives.'
const streamedText =
  'The check ran. The reader sees each new word at a steady pace while the response is still arriving.'

function streamingAssistantRow(text: string) {
  return { shape: 'prose' as const, id: 'streaming-text', role: 'assistant' as const, text }
}

const streamingTextFeed = {
  ...streamingFeed,
  revision: 'streaming-text-one',
  rows: [
    { shape: 'prose', id: 'streaming-prompt', role: 'user', text: 'Summarise the check.' },
    streamingAssistantRow(streamingText),
  ],
} satisfies SessionFeed

const streamedTextFeed = {
  ...streamingTextFeed,
  revision: 'streaming-text-three',
  rows: [...streamingTextFeed.rows.slice(0, 1), streamingAssistantRow(streamedText)],
} satisfies SessionFeed

const firstChunkFeed = {
  ...streamingTextFeed,
  revision: 'streaming-text-two',
  rows: [...streamingTextFeed.rows.slice(0, 1), streamingAssistantRow(firstChunkText)],
} satisfies SessionFeed

function StreamingTextFeed() {
  const [current, setCurrent] = useState<SessionFeed>(streamingTextFeed)
  const [running, setRunning] = useState(true)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(firstChunkFeed)}>
        Receive chunk
      </button>
      <button type="button" onClick={() => setCurrent(streamedTextFeed)}>
        Receive final chunk
      </button>
      <button type="button" onClick={() => setRunning(false)}>
        Complete reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          isRunning={running}
          selectedSessionId="streaming"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onAnswerQuestion={() => {}}
          onRetryFeed={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
        />
      </div>
    </div>
  )
}

// Streaming prose advances independently from the transcript poll: it first trails a new chunk,
// then reaches it, and completion settles the whole Message without waiting for another frame.
export const SmoothedStreamingText: Story = {
  render: () => <StreamingTextFeed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reply = () => drawnRow(canvasElement, 'streaming-text') as HTMLElement
    await waitFor(() => expect(reply()).toBeDefined())
    await expect(reply()).not.toHaveTextContent(streamingText)
    await waitFor(() => expect(reply()).toHaveTextContent(streamingText))
    await expect(canvas.getByRole('status')).toHaveTextContent('Assistant is responding.')
    await userEvent.click(canvas.getByRole('button', { name: 'Receive chunk' }))
    await expect(reply()).not.toHaveTextContent(firstChunkText)
    await expect(reply()).not.toHaveAttribute('data-revealing')
    await waitFor(() => expect(reply()).toHaveTextContent(firstChunkText), { timeout: 3000 })
    await userEvent.click(canvas.getByRole('button', { name: 'Receive final chunk' }))
    await expect(reply()).not.toHaveTextContent(streamedText)
    await userEvent.click(canvas.getByRole('button', { name: 'Complete reply' }))
    await waitFor(() => expect(reply()).toHaveTextContent(streamedText))
    await expect(canvas.getByRole('status')).toHaveTextContent('Assistant response complete.')
  },
}

export const SmoothedStreamingTextReducedMotion: Story = {
  render: () => <StreamingTextFeed />,
  play: async ({ canvasElement }) => {
    const restore = preferReducedMotion()
    try {
      const canvas = within(canvasElement)
      const reply = () => drawnRow(canvasElement, 'streaming-text') as HTMLElement
      await waitFor(() => expect(reply()).toHaveTextContent(streamingText))
      await userEvent.click(canvas.getByRole('button', { name: 'Receive chunk' }))
      await waitFor(() => expect(reply()).toHaveTextContent(firstChunkText))
    } finally {
      restore()
    }
  },
}

export const SmoothedStreamingTextSettled: Story = {
  args: { feed: streamedTextFeed, isRunning: false, selectedSessionId: 'streaming' },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(drawnRow(canvasElement, 'streaming-text')).toHaveTextContent(streamedText),
    )
  },
}

const runningToolFeed = {
  ...streamedTextFeed,
  revision: 'streaming-text-tool',
  rows: [
    ...streamedTextFeed.rows,
    { shape: 'command-output' as const, id: 'streaming-tool', text: 'Still working.' },
  ],
} satisfies SessionFeed

export const RunningToolAfterAssistantReply: Story = {
  args: { feed: runningToolFeed, isRunning: true, selectedSessionId: 'streaming' },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(drawnRow(canvasElement, 'streaming-text')).toHaveTextContent(streamedText),
    )
    await expect(drawnRow(canvasElement, 'streaming-tool')).toHaveTextContent('Still working.')
  },
}
