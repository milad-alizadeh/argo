import type { Meta, StoryObj } from '@storybook/react'
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
  title: 'Sessions/Basic Feed',
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
    await expect(prompt?.querySelector('[data-slot="bubble-content"]')).toHaveClass('type-prose')
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
          detail: '3 passed',
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

function FeedWithEvidence() {
  return (
    <BasicFeed
      failure={null}
      activeEvidenceId={null}
      feed={toolFeed}
      onOpenEvidence={() => {}}
      selectedSessionId="tools"
    />
  )
}

export const GroupedToolCalls: Story = {
  render: () => <FeedWithEvidence />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('button', { name: 'Ran 1 command · Edited 1 file' })
    await expect(canvas.queryByRole('button', { name: /Ran bun test composer/ })).toBeNull()
    await userEvent.click(group)
    const call = await canvas.findByRole('button', { name: /Ran bun test composer/ })
    await expect(group).toHaveClass('type-body')
    await expect(call).toHaveClass('type-body')
  },
}
