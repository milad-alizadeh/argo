import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import type { SessionError, SessionFeed } from '../types'

import { BasicFeed } from './BasicFeed'
import { RICH_MARKDOWN } from './content/feedSamples'

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
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-feed-row]')].filter(
    (row) => row.closest('.feed__measured') === null,
  )
}

// Each drawn row keeps the height its measured copy was given, after the highlighter and the
// images have finished (ADR-0035). User prose stays the text it was typed as.
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
    for (const row of drawnRows(canvasElement)) {
      const measured = canvasElement.querySelector(
        `.feed__measured [data-feed-row="${row.dataset.feedRow}"]`,
      )
      await expect(Number.parseFloat(row.style.height)).toBe(
        measured?.getBoundingClientRect().height,
      )
      await expect(row.scrollHeight).toBe(row.clientHeight)
    }
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

const toolFeed = {
  ...feed,
  chainId: 'tools',
  revision: 'tools-one',
  sessionId: 'tools',
  rows: [
    {
      shape: 'tool-group' as const,
      id: 'tool-group:one:two',
      label: 'Ran 1 command · Edited 1 file',
      calls: [
        {
          shape: 'tool' as const,
          id: 'one',
          kind: 'command' as const,
          label: 'Ran bun test composer',
          detail: null,
          status: 'succeeded' as const,
          evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
        },
        {
          shape: 'tool' as const,
          id: 'two',
          kind: 'edited' as const,
          label: 'Edited Composer.tsx',
          detail: '+2 −1',
          status: 'failed' as const,
          evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
        },
      ],
    },
  ],
} satisfies SessionFeed

export const GroupedToolCalls: Story = {
  args: { feed: toolFeed, selectedSessionId: 'tools' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('button', { name: 'Ran 1 command · Edited 1 file' })
    await userEvent.click(group)
    const call = await canvas.findByRole('button', { name: /Ran bun test composer/ })
    await expect(group).toHaveClass('type-body')
    await expect(call).toHaveClass('type-body')
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
        />
      </div>
    </div>
  )
}

function drawnRow(canvasElement: HTMLElement, id: string) {
  return drawnRows(canvasElement).find((row) => row.dataset.feedRow === id)
}

// History shows at once; a reply that arrives while the Feed is open is uncovered inside the
// height it was measured at, and ends with no mask left on the row.
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
    const measured = canvasElement.querySelector(
      '.feed__measured [data-feed-row="streaming-second"]',
    )
    await expect(Number.parseFloat(reply.style.height)).toBe(
      measured?.getBoundingClientRect().height,
    )
    await waitFor(() => expect(reply.getAnimations()).toHaveLength(0), { timeout: 3000 })
    await expect(getComputedStyle(reply).maskImage).toBe('none')
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
