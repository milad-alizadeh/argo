import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode, useState } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import type { SessionError, SessionFeed, SessionFeedRow } from '../types'
import { BackgroundWork, type BackgroundWorkLinks } from './background-work'
import { BasicFeed } from './basic-feed'
import { BROKEN_PICTURE, RICH_MARKDOWN, SAMPLE_PICTURE } from './content/feed-samples'
import { FeedJumpToLatest } from './feed-jump-to-latest'
import { type FeedLiveFacts, INACTIVE_FEED_LIVE_FACTS } from './feed-live-facts'

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

const LIVE_FACTS = INACTIVE_FEED_LIVE_FACTS

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
    liveFacts: LIVE_FACTS,
    onJumpToLatestChange: fn(),
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

const rowShapeFeed = {
  ...feed,
  sessionId: 'row-shapes',
  chainId: 'row-shapes',
  revision: 'row-shapes-one',
  rows: [
    {
      shape: 'tool',
      id: 'tool-row',
      kind: 'command',
      label: 'Ran a command',
      lineCounts: null,
      status: 'succeeded',
      evidence: null,
      text: 'bun test',
    },
    {
      shape: 'tool-group',
      id: 'tool-group-row',
      label: 'Ran a command',
      calls: [
        {
          shape: 'tool',
          id: 'grouped-tool-row',
          kind: 'command',
          label: 'Ran a grouped command',
          lineCounts: null,
          status: 'succeeded',
          evidence: null,
          text: 'bun run test',
        },
      ],
    },
    { shape: 'prose', id: 'prompt-row', role: 'user', text: 'Please inspect every row shape.' },
    {
      shape: 'prose',
      id: 'assistant-prose-row',
      role: 'assistant',
      text: 'Every row shape has a renderer.',
    },
    { shape: 'command-output', id: 'command-output-row', text: 'Command completed.' },
    { shape: 'event', id: 'event-row', event: 'status', text: 'Session is running.' },
    {
      shape: 'delegation',
      id: 'delegation-row',
      actor: 'agent',
      action: 'Review the Feed.',
      status: 'running',
      progress: 'Checking rows',
      groupId: null,
      callId: null,
    },
    {
      shape: 'delegation-group',
      id: 'delegation-group-row',
      actor: 'agent',
      groupId: 'delegation-group',
      entries: [
        {
          shape: 'delegation',
          id: 'delegation-group-entry',
          actor: 'agent',
          action: 'Run tests.',
          status: 'completed',
          progress: null,
          groupId: 'delegation-group',
          callId: 'call-tests',
        },
      ],
    },
    { shape: 'marker', id: 'marker-row', marker: 'interrupted', summary: null },
    {
      shape: 'source',
      id: 'source-row',
      role: 'assistant',
      label: 'A source row.',
      source: 'source-row',
    },
    { shape: 'image', id: 'image-row', role: 'assistant', source: SAMPLE_PICTURE },
    { shape: 'unreadable', id: 'unreadable-row' },
    {
      shape: 'ask',
      id: 'ask-row',
      answer: null,
      unsupported: null,
      questions: [
        {
          question: 'Should the Feed render every row shape?',
          header: null,
          multiSelect: false,
          options: [{ label: 'Yes', description: null }],
        },
      ],
    },
  ],
} satisfies SessionFeed

const ROW_SHAPE_ASSERTIONS = [
  ['tool-row', 'Ran a command'],
  ['tool-group-row', 'Ran a command'],
  ['prompt-row', 'Please inspect every row shape.'],
  ['assistant-prose-row', 'Every row shape has a renderer.'],
  ['command-output-row', 'Command completed.'],
  ['event-row', 'Status updated'],
  ['delegation-row', 'Review the Feed.'],
  ['delegation-group-row', 'Run tests.'],
  ['marker-row', 'Interrupted'],
  ['source-row', 'A source row.'],
  ['unreadable-row', 'Part of this transcript is damaged'],
  ['ask-row', 'Should the Feed render every row shape?'],
] as const

// This story renders every settled row shape through the public Feed surface rather than a renderer
// directly. A `thought` is not one: it draws only as the live tail (`ThoughtWhileThinking`).
export const EveryRowShape: Story = {
  args: { feed: rowShapeFeed, selectedSessionId: 'row-shapes' },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(drawnRows(canvasElement)).toHaveLength(rowShapeFeed.rows.length)
      for (const [id, text] of ROW_SHAPE_ASSERTIONS) {
        expect(canvasElement.querySelector(`[data-feed-row="${id}"]`)).toHaveTextContent(text)
      }
      // An image row is the picture itself, never its label.
      expect(canvasElement.querySelector('[data-feed-row="image-row"] img')).toBeInTheDocument()
    })
  },
}

export const Loading: Story = {
  args: { feed: null, failure: null, selectedSessionId: 'prose' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Loading this Session' }),
    ).toBeInTheDocument()
  },
}

const repeatTurnFeed = {
  ...feed,
  sessionId: 'repeat-turn',
  chainId: 'repeat-turn',
  revision: 'repeat-turn-one',
  rows: [
    { shape: 'prose', id: 'repeat-prompt-one', role: 'user', text: 'Inspect the Session.' },
    { shape: 'prose', id: 'repeat-reply-one', role: 'assistant', text: 'The Session is ready.' },
    { shape: 'prose', id: 'repeat-prompt-two', role: 'user', text: 'Inspect it again.' },
  ],
} satisfies SessionFeed

export const LoadingAfterAnotherPrompt: Story = {
  args: {
    feed: repeatTurnFeed,
    liveFacts: { ...LIVE_FACTS, isRunning: true },
    selectedSessionId: 'repeat-turn',
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Loading this Session' }),
    ).toBeInTheDocument()
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
  args: { feed: null, failure: null, liveFacts: null, selectedSessionId: null },
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
      status: 'completed',
      progress: null,
      groupId: 'review',
      callId: null,
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
          action: 'Build the app',
          status: 'running',
          progress: 'Started bun run build',
          groupId: 'build',
          callId: 'call-build',
        },
        {
          shape: 'delegation' as const,
          id: 'shell-build-end',
          actor: 'shell' as const,
          action: 'Build the app',
          status: 'completed',
          progress: null,
          groupId: 'build',
          callId: 'call-build',
        },
      ],
    },
  ],
} satisfies SessionFeed

const BUILD_COMMAND = {
  id: 'call-build',
  command: 'bun run build',
  label: null,
  background: true,
  state: 'completed' as const,
  startedAt: '2026-09-02T08:00:00.000Z',
  endedAt: '2026-09-02T08:01:12.000Z',
  outputPath: null,
  result: null,
}

const REVIEW_AGENT = {
  id: 'call-review',
  label: 'Review the Feed card for keyboard access.',
  landed: true,
  startedAt: '2026-09-02T08:00:00.000Z',
  endedAt: '2026-09-02T08:01:12.000Z',
}

// The Session screen's links, reduced to the command and the Subagent this Feed names.
function LinkedFeed(args: React.ComponentProps<typeof BasicFeed>) {
  const [opened, setOpened] = useState<string | null>(null)
  const links: BackgroundWorkLinks = {
    find: ({ callId, name }) => {
      if (callId === BUILD_COMMAND.id) return { kind: 'shell', command: BUILD_COMMAND }
      if (name !== REVIEW_AGENT.label) return null
      return {
        kind: 'delegation',
        delegation: REVIEW_AGENT,
        usage: { tokens: 4200, model: 'gpt-5.6-terra' },
      }
    },
    open: (target) =>
      setOpened(target.kind === 'shell' ? target.command.command : target.delegation.label),
  }
  return (
    <BackgroundWork.Provider value={links}>
      <output className="sr-only">{opened === null ? '' : `Opened ${opened}`}</output>
      <BasicFeed {...args} />
    </BackgroundWork.Provider>
  )
}

// Each block titles its work and shows only the newest line, and opens its feed or terminal.
export const DelegationCards: Story = {
  args: { feed: delegationFeed, selectedSessionId: 'delegations' },
  render: (args) => <LinkedFeed {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const agent = canvas.getByRole('region', { name: 'Background Agent' })
    await expect(agent).toHaveTextContent('Done')
    await expect(within(agent).getByText('Done')).not.toHaveClass('sr-only')
    await expect(agent).toHaveTextContent('Review the Feed card for keyboard access.')
    await expect(agent).not.toHaveClass('border-b')
    await expect(agent).toHaveTextContent('gpt-5.6-terra · 1m 12s · 4.2k tokens')
    await userEvent.click(
      within(agent).getByRole('button', {
        name: 'Open the Review the Feed card for keyboard access. Session',
      }),
    )
    await expect(
      canvas.getByText('Opened Review the Feed card for keyboard access.'),
    ).toBeInTheDocument()
    const shell = canvas.getByRole('region', { name: 'Background Task' })
    await expect(shell).toHaveTextContent('Build the app')
    await expect(shell).toHaveTextContent('Completed')
    await expect(shell).toHaveTextContent('1m 12s')
    await expect(shell).toHaveTextContent('bun run build')
    await expect(shell).not.toHaveTextContent('Started bun run build')
    await userEvent.click(within(shell).getByRole('button'))
    await expect(canvas.getByText('Opened bun run build')).toBeInTheDocument()
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
    {
      shape: 'event' as const,
      id: 'event-status',
      event: 'status' as const,
      text: 'running',
      raw: null,
    },
    {
      shape: 'event' as const,
      id: 'event-transcript',
      event: 'transcript' as const,
      text: null,
      raw: null,
    },
    {
      shape: 'event' as const,
      id: 'event-context',
      event: 'context' as const,
      text: null,
      raw: null,
    },
    {
      shape: 'event' as const,
      id: 'event-command',
      event: 'command' as const,
      text: commandReceipt,
      raw: null,
    },
    {
      shape: 'event' as const,
      id: 'event-status-raw',
      event: 'status' as const,
      text: 'starting',
      raw: '<status>starting</status>',
    },
  ],
} satisfies SessionFeed

export const ProtocolEvents: Story = {
  args: { feed: eventFeed, selectedSessionId: 'events' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Status updated')).toHaveLength(2)
    await expect(canvas.getByText('running')).toBeVisible()
    await expect(canvas.getByText('Transcript delivered')).toBeVisible()
    await expect(canvas.getByText('System context updated')).toBeVisible()
    await expect(canvas.getByText('Command received')).toBeVisible()
    await expect(canvas.getByText(commandReceipt)).toBeVisible()
    await expect(canvas.queryByText('<status>running</status>')).toBeNull()
    await expect(canvasElement.querySelectorAll('[data-slot="feed-event"]')).toHaveLength(5)

    const rawEvent = canvasElement.querySelector('[data-feed-row="event-status-raw"]')
    if (rawEvent === null) throw new Error('Expected the raw-protocol event row to render.')
    const rawEventCanvas = within(rawEvent as HTMLElement)
    const summary = rawEventCanvas.getByText('Protocol text')
    const rawText = rawEventCanvas.getByText('<status>starting</status>')
    await expect(rawText).not.toBeVisible()
    await userEvent.click(summary)
    await expect(rawText).toBeVisible()
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
    await expect(canvas.getByRole('button', { name: 'Open the Implement skill' })).toBeVisible()
    await expect(
      canvas.getByRole('link', { name: 'https://github.com/milad-alizadeh/argo/issues/1944' }),
    ).toBeVisible()
  },
}

const promptImagesFeed = {
  ...feed,
  sessionId: 'prompt-images',
  chainId: 'prompt-images',
  revision: 'prompt-images-one',
  rows: [
    {
      shape: 'prose' as const,
      id: 'prompt-images-words',
      role: 'user' as const,
      text: 'I asked to remove the indentation.',
      images: [SAMPLE_PICTURE, BROKEN_PICTURE],
    },
    {
      shape: 'prose' as const,
      id: 'prompt-images-reply',
      role: 'assistant' as const,
      text: 'Looking.',
    },
    {
      shape: 'prose' as const,
      id: 'prompt-images-alone',
      role: 'user' as const,
      text: '',
      images: [SAMPLE_PICTURE],
    },
  ],
} satisfies SessionFeed

// A prompt's images are thumbnails inside its bubble, above its words, and each opens full size.
export const PromptWithImages: Story = {
  args: { feed: promptImagesFeed, selectedSessionId: 'prompt-images' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(3))
    const [prompt, , imagesAlone] = drawnRows(canvasElement)
    const bubble = prompt?.querySelector<HTMLElement>('[data-slot="bubble"]')
    if (!bubble) throw new Error('expected the prompt to draw a bubble')
    const thumbnail = within(bubble).getByRole('button', { name: 'Open attached image 1' })
    await waitFor(() => expect(thumbnail).toHaveAttribute('data-state', 'loaded'))
    const side = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--size-feed-attachment-preview'),
    )
    await expect(thumbnail.getBoundingClientRect().width).toBe(side)
    await expect(thumbnail.getBoundingClientRect().height).toBe(side)
    const missing = await within(bubble).findByRole('figure')
    await expect(within(missing).getByText('Image unavailable')).toBeInTheDocument()
    await expect(within(missing).getByText('Attached image 2')).toBeInTheDocument()
    const words = within(bubble).getByText('I asked to remove the indentation.')
    await expect(thumbnail.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      words.getBoundingClientRect().top,
    )
    await expect(imagesAlone?.querySelector('[data-slot="bubble"] p')).toBeNull()
    await userEvent.click(thumbnail)
    const dialog = await within(document.body).findByRole('dialog')
    await expect(within(dialog).getByRole('img', { name: 'Attached image 1' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull())
    // Drawn inside, the ring would sit on the picture, where a pale screenshot hides it.
    await waitFor(() => expect(thumbnail.matches(':focus-visible')).toBe(true))
    await expect(Number.parseFloat(getComputedStyle(thumbnail).outlineOffset)).toBeGreaterThan(0)
  },
}

const promptFilesFeed = {
  ...feed,
  sessionId: 'prompt-files',
  chainId: 'prompt-files',
  revision: 'prompt-files-one',
  rows: [
    {
      shape: 'prose' as const,
      id: 'prompt-files-words',
      role: 'user' as const,
      text: 'Merge these two plans.',
      files: ['/Users/x/notes.md', '/Users/x/plan.v2.md'],
    },
    {
      shape: 'prose' as const,
      id: 'prompt-files-alone',
      role: 'user' as const,
      text: '',
      files: ['/Users/x/report.pdf'],
    },
  ],
} satisfies SessionFeed

// A prompt's other files are chips inside its bubble, as the composer showed them before Send.
export const PromptWithFiles: Story = {
  args: { feed: promptFilesFeed, selectedSessionId: 'prompt-files' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
    const [prompt, filesAlone] = drawnRows(canvasElement)
    const bubble = prompt?.querySelector<HTMLElement>('[data-slot="bubble"]')
    if (!bubble || !filesAlone) throw new Error('expected both prompts to draw')
    const chip = within(bubble).getByText('notes')
    await expect(within(bubble).getByText('plan.v2')).toBeVisible()
    await expect(within(bubble).getAllByText('MD file')).toHaveLength(2)
    const words = within(bubble).getByText('Merge these two plans.')
    await expect(chip.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      words.getBoundingClientRect().top,
    )
    await expect(within(bubble).queryByRole('button')).toBeNull()
    await expect(within(filesAlone).getByText('PDF file')).toBeVisible()
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
          lineCounts: null,
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
          lineCounts: { added: 2, removed: 1 },
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
    // A command inside a group is its own disclosure, closed until the reader opens it.
    await userEvent.click(await canvas.findByRole('button', { name: 'Ran a command' }))
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

// A disclosure the reader opens at the latest row grows down from the control they pressed,
// instead of the Feed pinning its bottom and sliding that control up the screen.
export const DisclosureAtLatestKeepsItsControlStill: Story = {
  args: { feed: toolFeed, selectedSessionId: 'tools' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Ran a command, edited a file' })
    const groupTop = group.getBoundingClientRect().top
    await userEvent.click(group)
    const call = await canvas.findByRole('button', { name: 'Ran a command' })
    await waitFor(() => expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0))
    await expect(group.getBoundingClientRect().top).toBeCloseTo(groupTop, 0)
    const callTop = call.getBoundingClientRect().top
    await userEvent.click(call)
    await waitFor(() => expect(call).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0))
    await expect(call.getBoundingClientRect().top).toBeCloseTo(callTop, 0)
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
          lineCounts: null,
          status: 'succeeded' as const,
          evidence: null,
          text: 'bun test',
        },
        {
          shape: 'tool' as const,
          id: 'run-one-types',
          kind: 'command' as const,
          label: 'Ran bun run typecheck',
          lineCounts: null,
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
          lineCounts: null,
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
    // Settled runs side by side fold into one count; no command names itself in the Feed.
    await expect(canvas.getByRole('button', { name: 'Ran 3 commands' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Ran 2 commands' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Ran bunx biome check .' })).toBeNull()
  },
}

// One feed holding every row variation the Feed draws today, for visual review in one place:
// a solo skill invocation, a mixed command/edit group, an unclassified tool with no output, a
// running agent delegation, a completed shell delegation group, and a reply with a bold link.
const allVariationsFeed = {
  ...feed,
  chainId: 'all-variations',
  revision: 'all-variations-one',
  sessionId: 'all-variations',
  rows: [
    {
      shape: 'prose' as const,
      id: 'variations-skill-label',
      role: 'assistant' as const,
      text: '**Skill invocation** (its own line, never mixed with another tool kind)',
    },
    {
      shape: 'tool-group' as const,
      id: 'tool-group:skill',
      label: 'Invoked a skill',
      calls: [
        {
          shape: 'tool' as const,
          id: 'skill-call',
          kind: 'skill' as const,
          label: 'Simple english',
          lineCounts: null,
          status: 'succeeded' as const,
          evidence: null,
          text: '# Simple English\n\nWrite plain English a reader understands on one read.',
        },
      ],
    },
    {
      shape: 'prose' as const,
      id: 'variations-group-label',
      role: 'assistant' as const,
      text: '**Mixed tool group** (a command inline, an edit routed to the evidence panel)',
    },
    {
      shape: 'tool-group' as const,
      id: 'tool-group:mixed',
      label: 'Ran a command, edited a file',
      calls: [
        {
          shape: 'tool' as const,
          id: 'mixed-command',
          kind: 'command' as const,
          label: 'Ran bun test composer',
          lineCounts: null,
          status: 'succeeded' as const,
          evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
          text: 'bun test composer',
        },
        {
          shape: 'tool' as const,
          id: 'mixed-edit',
          kind: 'edited' as const,
          label: 'Edited Composer.tsx',
          lineCounts: { added: 3, removed: 1 },
          status: 'succeeded' as const,
          evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
          text: null,
        },
      ],
    },
    {
      shape: 'prose' as const,
      id: 'variations-empty-label',
      role: 'assistant' as const,
      text: '**Unclassified tool with no output** (a running or empty-result call)',
    },
    {
      shape: 'tool-group' as const,
      id: 'tool-group:empty',
      label: 'Ran a command',
      calls: [
        {
          shape: 'tool' as const,
          id: 'empty-call',
          kind: 'tool' as const,
          label: 'Ran an unclassified tool',
          lineCounts: null,
          status: 'succeeded' as const,
          evidence: null,
          text: null,
        },
      ],
    },
    {
      shape: 'prose' as const,
      id: 'variations-delegation-label',
      role: 'assistant' as const,
      text: '**Delegation cards** (an agent still running, a shell activity group that completed)',
    },
    {
      shape: 'delegation' as const,
      id: 'variations-agent',
      actor: 'agent' as const,
      action: 'Review the Feed card for keyboard access.',
      status: 'running',
      progress: 'Checking focus and motion',
      groupId: 'variations-review',
      callId: null,
    },
    {
      shape: 'delegation-group' as const,
      id: 'delegation:variations-build',
      actor: 'shell' as const,
      groupId: 'variations-build',
      entries: [
        {
          shape: 'delegation' as const,
          id: 'variations-shell-start',
          actor: 'shell' as const,
          action: 'Started bun run build',
          status: 'running',
          progress: null,
          groupId: 'variations-build',
          callId: null,
        },
        {
          shape: 'delegation' as const,
          id: 'variations-shell-end',
          actor: 'shell' as const,
          action: 'Build completed',
          status: 'completed',
          progress: null,
          groupId: 'variations-build',
          callId: null,
        },
      ],
    },
    {
      shape: 'prose' as const,
      id: 'variations-link-label',
      role: 'assistant' as const,
      text: '**Reply with a link** (renders bold, like the rest of a Markdown reply)',
    },
    {
      shape: 'prose' as const,
      id: 'variations-link',
      role: 'assistant' as const,
      text: 'PR opened: [https://github.com/milad-alizadeh/argo/pull/2203](https://github.com/milad-alizadeh/argo/pull/2203)',
    },
  ],
} satisfies SessionFeed

export const AllRowVariations: Story = {
  args: { feed: allVariationsFeed, selectedSessionId: 'all-variations' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Simple english' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Ran a command, edited a file' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Ran a command' })).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Background Agent' })).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Background Task' })).toBeVisible()
    const link = canvas.getByRole('link', {
      name: 'https://github.com/milad-alizadeh/argo/pull/2203',
    })
    await expect(link).toBeVisible()
    await expect(link).toHaveClass('font-semibold')
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
          liveFacts={LIVE_FACTS}
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

const historyRows = Array.from({ length: 60 }, (_unused, index) => ({
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
const historyAnchorId = `history-${Math.floor(historyRows.length / 2)}`

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
          liveFacts={LIVE_FACTS}
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
          liveFacts={LIVE_FACTS}
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
          liveFacts={LIVE_FACTS}
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

// A reader away from the tail gets a way to return after a reply arrives.
export const HistoryOffersJumpToLatestAfterNewReply: Story = {
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

const SENT_PROMPT = 'Tighten the Feed spacing around tool groups.'
const repliedHistoryFeed = {
  ...historyFeed,
  revision: 'history-replied',
  rows: [
    ...historyRows,
    { shape: 'prose' as const, id: 'history-prompt', role: 'user' as const, text: SENT_PROMPT },
    {
      shape: 'prose' as const,
      id: 'history-reply',
      role: 'assistant' as const,
      text: 'Reading the tool group styles first.',
    },
  ],
} satisfies SessionFeed

function SendPromptHarness() {
  const [current, setCurrent] = useState<SessionFeed>(historyFeed)
  const [sent, setSent] = useState<SessionFeedRow | null>(null)
  const send = () =>
    setSent({ shape: 'prose', id: 'optimistic-turn:1', role: 'user', text: SENT_PROMPT })
  const reply = () => {
    setSent(null)
    setCurrent(repliedHistoryFeed)
  }
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={send}>
        Send prompt
      </button>
      <button type="button" onClick={reply}>
        Receive reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          answeringQuestionId={null}
          failure={null}
          feed={current}
          liveFacts={{ ...LIVE_FACTS, optimisticRow: sent }}
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

// Near the top: the Feed's scroll padding sits above the prompt, and nothing else does.
const PROMPT_TOP_PX = 40

// The prompt's distance below the top of the Feed viewport.
function promptOffset(history: HTMLElement) {
  const prompt = within(history).getByText(SENT_PROMPT)
  const row = prompt.closest('[data-index]')
  if (row === null) throw new Error('The sent prompt is not a drawn Feed row.')
  return row.getBoundingClientRect().top - history.getBoundingClientRect().top
}

// A sent prompt rises to the top of the Feed and the reply streams into the room below it.
export const SentPromptRisesToTop: Story = {
  render: () => <SendPromptHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    await userEvent.click(canvas.getByRole('button', { name: 'Send prompt' }))
    await waitFor(() => expect(promptOffset(history)).toBeLessThan(PROMPT_TOP_PX))
    await userEvent.click(canvas.getByRole('button', { name: 'Receive reply' }))
    await canvas.findByText('Reading the tool group styles first.')
    await waitFor(() => expect(promptOffset(history)).toBeLessThan(PROMPT_TOP_PX))
  },
}

export const HistoryKeepsItsAnchorWhenEarlierRowsArrive: Story = {
  render: () => <HistoryPrependHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    history.scrollTop = history.scrollHeight / 2
    fireEvent.scroll(history)
    await waitFor(() => expect(drawnRow(canvasElement, historyAnchorId)).toBeDefined())
    const anchoredRow = drawnRow(canvasElement, historyAnchorId)
    await userEvent.click(canvas.getByRole('button', { name: 'Load earlier history' }))
    await waitFor(() => expect(drawnRow(canvasElement, historyAnchorId)).toBe(anchoredRow))
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
          liveFacts={{ ...LIVE_FACTS, isRunning: true, posture: 'external' }}
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
          liveFacts={{ ...LIVE_FACTS, posture: 'external' }}
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
// Extends `firstChunkText` rather than rewording its tail, so the reveal keeps walking forward
// from where it left off instead of snapping (`advanceVisibleText` only replays a shared prefix).
const streamedText = `${firstChunkText} The check passed.`

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
          liveFacts={{ ...LIVE_FACTS, isRunning: running }}
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
    // Not asserted un-revealed first: the opening text is three words, short enough that a
    // slow CI paint can let the catch-up rate clear it before this line ever runs.
    await waitFor(() => expect(reply()).toHaveTextContent(streamingText))
    await expect(canvas.getByRole('status')).toHaveTextContent('Assistant is responding.')
    await userEvent.click(canvas.getByRole('button', { name: 'Receive chunk' }))
    await expect(reply()).not.toHaveAttribute('data-revealing')
    await waitFor(() => expect(reply()).toHaveTextContent(firstChunkText), { timeout: 3000 })
    await userEvent.click(canvas.getByRole('button', { name: 'Receive final chunk' }))
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

const thinkingPrompt = {
  shape: 'prose',
  id: 'thinking-prompt',
  role: 'user',
  text: 'Add a single parent ticket.',
} satisfies SessionFeedRow

// Two reasoning records in a row, the way Codex writes them. The Feed never draws them as rows:
// the newest is the Session's activity, the same fact the roster line reads.
const thinkingFeed = {
  ...feed,
  sessionId: 'thinking',
  chainId: 'thinking',
  revision: 'thinking-one',
  rows: [
    thinkingPrompt,
    { shape: 'thought', id: 'thought-one', text: 'Planning parent and child ticket labeling' },
    { shape: 'thought', id: 'thought-two', text: 'Designing issue creation order and labeling' },
  ],
} satisfies SessionFeed
const thinkingActivity = {
  kind: 'thought',
  label: 'Designing issue creation order and labeling',
  open: true,
  tool: 'reasoning',
  target: null,
} satisfies NonNullable<FeedLiveFacts>['activity']

const thoughtDeliveredFeed = {
  ...thinkingFeed,
  revision: 'thinking-two',
  rows: [
    ...thinkingFeed.rows,
    { shape: 'prose', id: 'thinking-reply', role: 'assistant', text: 'One parent issue, then.' },
  ],
} satisfies SessionFeed

function ThinkingFeed() {
  const [current, setCurrent] = useState<SessionFeed>(thinkingFeed)
  const [running, setRunning] = useState(true)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(thoughtDeliveredFeed)}>
        Deliver reply
      </button>
      <button type="button" onClick={() => setRunning(false)}>
        Complete turn
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          liveFacts={{ ...LIVE_FACTS, isRunning: running, activity: thinkingActivity }}
          selectedSessionId="thinking"
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

// A thought is a status, not history: only the newest shows, only while the agent is still
// thinking, and it leaves the Feed the moment the reply lands.
export const ThoughtWhileThinking: Story = {
  render: () => <ThinkingFeed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(drawnRow(canvasElement, 'thinking:activity')).toHaveTextContent(
        'Designing issue creation order and labeling',
      )
      expect(
        drawnRow(canvasElement, 'thinking:activity')?.querySelector('.feed-work-shimmer'),
      ).not.toBeNull()
    })
    expect(drawnRow(canvasElement, 'thought-one')).toBeUndefined()
    expect(drawnRow(canvasElement, 'thought-two')).toBeUndefined()
    // The shimmering thought already says the agent is working; the marker does not say it twice.
    expect(canvas.queryByRole('status', { name: 'Working' })).toBeNull()
    // Prose delivered mid-Turn lands above the thought, which stays the tail as Codex keeps its
    // headline, until the Turn ends or a newer thought replaces it.
    await userEvent.click(canvas.getByRole('button', { name: 'Deliver reply' }))
    await waitFor(() => {
      expect(drawnRow(canvasElement, 'thinking-reply')).toHaveTextContent('One parent issue, then.')
      const rows = drawnRows(canvasElement).map((row) => row.getAttribute('data-feed-row'))
      expect(rows.indexOf('thinking:activity')).toBe(rows.indexOf('thinking-reply') + 1)
    })
  },
}

// The Turn can end on a thought, as an interrupted one does; a thought never outlives its Turn.
export const ThoughtLeavesWithItsTurn: Story = {
  render: () => <ThinkingFeed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(drawnRow(canvasElement, 'thinking:activity')).toBeDefined())
    await userEvent.click(canvas.getByRole('button', { name: 'Deliver reply' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'thinking-reply')).toBeDefined())
    await userEvent.click(canvas.getByRole('button', { name: 'Complete turn' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'thinking:activity')).toBeUndefined())
    expect(drawnRow(canvasElement, 'thinking-prompt')).toBeDefined()
  },
}

export const SmoothedStreamingTextSettled: Story = {
  args: { feed: streamedTextFeed, liveFacts: LIVE_FACTS, selectedSessionId: 'streaming' },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(drawnRow(canvasElement, 'streaming-text')).toHaveTextContent(streamedText),
    )
  },
}

const scrollAwayStreamingText = Array.from(
  { length: 400 },
  (_unused, index) => `word${index}`,
).join(' ')
const scrollAwayFillerRows = Array.from({ length: 120 }, (_unused, index) => ({
  shape: 'prose' as const,
  id: `scroll-away-filler-${index}`,
  role: 'assistant' as const,
  text: `Filler row ${index + 1} pushes the streaming reply out of the overscan window.`,
}))
const scrollAwayFeed = {
  ...streamingTextFeed,
  revision: 'scroll-away-one',
  rows: [
    { shape: 'prose', id: 'scroll-away-prompt', role: 'user', text: 'Summarise the check.' },
    ...scrollAwayFillerRows,
    streamingAssistantRow(scrollAwayStreamingText),
  ],
} satisfies SessionFeed

// The virtualizer unmounts a row once it scrolls past the overscan window (#2100): its reveal
// must resume from where it left off, not restart from empty, when the reader scrolls back. The
// streaming row is last (`FeedDocument`'s `streamingRowId` only marks the last row streaming), so
// it starts in view and scrolling to the top is what pushes it out of the overscan window.
export const StreamingRevealSurvivesScrollAway: Story = {
  args: {
    feed: scrollAwayFeed,
    liveFacts: { ...LIVE_FACTS, isRunning: true },
    selectedSessionId: 'streaming',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const history = await canvas.findByLabelText('Session history')
    const reply = () => drawnRow(canvasElement, 'streaming-text')
    await waitFor(() => expect(reply()).toBeDefined())
    await waitFor(() => {
      const text = reply()?.textContent ?? ''
      expect(text.length).toBeGreaterThan(0)
      expect(text.length).toBeLessThan(scrollAwayStreamingText.length)
    })
    const revealedBeforeScroll = reply()?.textContent ?? ''

    history.scrollTop = 0
    fireEvent.scroll(history)
    await waitFor(() => expect(reply()).toBeUndefined())

    history.scrollTop = history.scrollHeight
    fireEvent.scroll(history)
    await waitFor(() => expect(reply()).toBeDefined())
    // A reset-to-empty regression would show only the status announcement (~25 characters); this
    // This short wait lets React paint the cached text after the virtualizer remounts the row.
    await waitFor(
      () =>
        expect((reply()?.textContent ?? '').length).toBeGreaterThan(
          revealedBeforeScroll.length * 0.5,
        ),
      { timeout: 500 },
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
  args: {
    feed: runningToolFeed,
    liveFacts: { ...LIVE_FACTS, isRunning: true },
    selectedSessionId: 'streaming',
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(drawnRow(canvasElement, 'streaming-text')).toHaveTextContent(streamedText),
    )
    await expect(drawnRow(canvasElement, 'streaming-tool')).toHaveTextContent('Still working.')
  },
}
