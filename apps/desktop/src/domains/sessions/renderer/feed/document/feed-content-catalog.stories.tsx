import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { feedReadingRows } from '@/domains/sessions/api/feed/feed-reading-rows'
import { projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionFeed } from '../../types'
import { BasicFeed } from './basic-feed'

const meta = {
  title: 'Sessions/Feed/Content catalog',
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
    failure: null,
    running: false,
    posture: null,
    selectedSessionId: 'catalog',
    onOpenEvidence: fn(),
    onJumpToLatestChange: fn(),
    onStalledChange: fn(),
    onRetryFeed: fn(),
    onAnswerQuestion: fn(),
    answeringQuestionId: null,
    questionFailure: () => null,
  },
} satisfies Meta<typeof BasicFeed>
export default meta
type Story = StoryObj<typeof BasicFeed>

// The same projection main's reader runs, so a catalog row is the row the cockpit draws.
function catalogFeedContents(content: FeedContent[], running = false): SessionFeed {
  const revision = content.map((item) => item.id).join(':') || 'empty'
  const { entries } = projectFeedRowEntries({ history: content, live: [] })
  return {
    sessionId: 'catalog',
    chainId: 'catalog',
    revision,
    rows: [...feedReadingRows(entries, { running })],
  }
}

function catalogFeed(content: FeedContent, running = false): SessionFeed {
  return catalogFeedContents([content], running)
}

function kindStory(content: FeedContent, visible: string): Story {
  return {
    args: { feed: catalogFeed(content) },
    play: async ({ canvasElement }) => {
      await waitFor(() =>
        expect(canvasElement.querySelector('[data-feed-row]')).toHaveTextContent(visible),
      )
    },
  }
}

export const Message = kindStory(
  { kind: 'message', id: 'message', role: 'assistant', text: 'The Feed is ready.' },
  'The Feed is ready.',
)
export const Reasoning = kindStory(
  { kind: 'reasoning', id: 'reasoning', text: 'Inspecting the Session', redacted: false },
  'Inspecting the Session',
)
export const Media: Story = {
  args: {
    feed: catalogFeed({
      kind: 'media',
      id: 'media',
      mediaType: 'image',
      source: {
        kind: 'data',
        mimeType: 'image/gif',
        base64: 'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      },
      role: 'user',
    }),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-feed-row] img')).toBeInTheDocument(),
    )
  },
}
export const Reference = kindStory(
  {
    kind: 'reference',
    id: 'reference',
    referenceType: 'file',
    label: 'Source file',
    target: '/repo/feed.ts',
    text: null,
  },
  'Source file',
)
const runningTool: FeedContent = {
  kind: 'tool',
  id: 'tool',
  callId: 'call-1',
  name: 'Bash',
  status: 'running',
  input: { command: 'bun test' },
  output: null,
  summary: null,
  presentation: { kind: 'command', label: 'Run the Feed tests', agentDescription: true },
}
// A running call names its group only while it is the running Turn's activity.
export const Tool: Story = {
  args: {
    feed: catalogFeed(runningTool, true),
    running: true,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-feed-row]')).toHaveTextContent(
        'Run the Feed tests',
      ),
    )
  },
}
export const Command = kindStory(
  {
    kind: 'command',
    id: 'command',
    command: 'bun test',
    cwd: '/repo',
    status: 'completed',
    output: '20 pass',
    stderr: null,
    exitCode: 0,
  },
  'Ran a command',
)
export const FileChange = kindStory(
  {
    kind: 'fileChange',
    id: 'file-change',
    status: 'completed',
    changes: [{ path: '/repo/feed.ts', change: 'update', diff: '+new line' }],
  },
  'Edited a file',
)
export const Search = kindStory(
  { kind: 'search', id: 'search', query: 'FeedContent', action: null, results: [] },
  'FeedContent',
)
export const Plan = kindStory(
  { kind: 'plan', id: 'plan', text: 'Inspect the Feed' },
  'Inspect the Feed',
)
export const Delegation = kindStory(
  {
    kind: 'delegation',
    id: 'delegation',
    event: 'started',
    agentId: 'agent-1',
    status: 'running',
    name: 'Review the Feed',
    prompt: 'Review the Feed',
    model: null,
    summary: null,
  },
  'Review the Feed',
)
export const Task = kindStory(
  {
    kind: 'task',
    id: 'task',
    taskId: 'task-1',
    callId: null,
    status: 'paused',
    description: 'Check the Feed',
    summary: null,
  },
  'Check the Feed',
)
export const Notification = kindStory(
  {
    kind: 'notification',
    id: 'notification',
    category: 'info',
    text: 'Connected to the Session',
    priority: null,
  },
  'Connected to the Session',
)
// A system context update is for the model; the Feed draws nothing for it.
export const Context: Story = {
  args: {
    feed: catalogFeedContents([
      { kind: 'message', id: 'message', role: 'assistant', text: 'The Feed is ready.' },
      { kind: 'context', id: 'context', source: 'environment', text: 'Workspace ready' },
    ]),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-feed-row]')).toHaveTextContent(
        'The Feed is ready.',
      ),
    )
    await expect(canvasElement.querySelectorAll('[data-feed-row]')).toHaveLength(1)
    await expect(canvasElement).not.toHaveTextContent('Workspace ready')
    await expect(canvasElement).not.toHaveTextContent('System context updated')
  },
}
export const Marker = kindStory(
  { kind: 'marker', id: 'marker', marker: 'compaction', summary: 'Earlier work' },
  'Conversation compacted',
)
export const Refusal = kindStory(
  { kind: 'refusal', id: 'refusal', reason: 'permission', text: 'Permission denied' },
  'Permission denied',
)
export const ImageGeneration = kindStory(
  {
    kind: 'imageGeneration',
    id: 'image-generation',
    status: 'failed',
    prompt: 'A map',
    source: null,
    failure: 'No image',
  },
  'No image',
)
export const Wait = kindStory({ kind: 'wait', id: 'wait', durationMs: 500 }, '500 ms')
export const Diagnostic = kindStory(
  { kind: 'diagnostic', id: 'diagnostic', vendorType: 'unknownItem', detail: 'Unsupported' },
  'Unsupported item',
)

function workStateContents(status: 'running' | 'completed' | 'failed'): FeedContent[] {
  return [
    {
      kind: 'tool',
      id: `tool-${status}`,
      callId: `call-${status}`,
      name: 'Read',
      status,
      input: null,
      output: null,
      summary: null,
      presentation: { kind: 'read', label: 'Read the Feed file' },
    },
    {
      kind: 'command',
      id: `command-${status}`,
      command: 'bun test',
      cwd: '/repo',
      status,
      output: null,
      stderr: null,
      exitCode: null,
    },
    { kind: 'fileChange', id: `file-${status}`, status, changes: [] },
    {
      kind: 'delegation',
      id: `agent-${status}`,
      event: status === 'running' ? 'started' : 'responded',
      agentId: `agent-${status}`,
      status,
      name: 'Review the Feed',
      prompt: null,
      model: null,
      summary: null,
    },
    {
      kind: 'task',
      id: `task-${status}`,
      taskId: `task-${status}`,
      callId: null,
      status,
      description: 'Check the Feed',
      summary: null,
    },
    {
      kind: 'imageGeneration',
      id: `image-${status}`,
      status,
      prompt: 'A map',
      source: null,
      failure: status === 'failed' ? 'No image' : null,
    },
  ]
}

function workStateStory(status: 'running' | 'completed' | 'failed', label: string): Story {
  return {
    args: { feed: catalogFeedContents(workStateContents(status)) },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement)
      await waitFor(() => {
        expect(canvas.getByText('Image generation')).toBeVisible()
        expect(canvas.getByText('File change')).toBeVisible()
        expect(canvas.getAllByText(label)[0]).toBeVisible()
      })
    },
  }
}

export const Empty: Story = {
  args: { feed: catalogFeedContents([]) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).findByText('No messages')).resolves.toBeVisible()
  },
}
export const RunningWork = workStateStory('running', 'Running')
export const CompletedWork = workStateStory('completed', 'Completed')
export const FailedWork = workStateStory('failed', 'Failed')
export const Unsupported: Story = {
  args: {
    feed: catalogFeedContents([
      { kind: 'reasoning', id: 'redacted', text: null, redacted: true },
      {
        kind: 'media',
        id: 'audio',
        mediaType: 'audio',
        source: { kind: 'url', url: 'https://example.invalid/sound.wav' },
        role: 'assistant',
      },
      { kind: 'diagnostic', id: 'unknown', vendorType: 'futureItem', detail: 'Unsupported' },
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Unsupported item')).toBeVisible())
    // Withheld reasoning has nothing to read, so it draws no tile.
    expect(canvas.queryByText('Reasoning unavailable')).toBeNull()
  },
}

// Live commentary after a call titles its group once, as Markdown.
export const CommentaryAfterTool: Story = {
  args: {
    feed: catalogFeedContents(
      [
        {
          kind: 'tool',
          id: 'commentary-tool',
          callId: 'commentary-call',
          name: 'Read',
          status: 'completed',
          input: null,
          output: null,
          summary: null,
        },
        {
          kind: 'message',
          id: 'commentary-message',
          role: 'assistant',
          phase: 'commentary',
          text: '**Checking** the result',
        },
      ],
      true,
    ),
    running: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Checking', { selector: 'strong' })).toBeVisible())
    await expect(canvas.getAllByText('Checking', { selector: 'strong' })).toHaveLength(1)
    await expect(canvas.queryByText(/\*\*/)).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Checking the result' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  },
}
