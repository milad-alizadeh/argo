import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionFeed } from '../../types'
import { projectLiveFeedRows } from '../model/live-feed-rows'
import { groupToolRuns } from '../model/tool-groups'
import { BasicFeed } from './basic-feed'
import { INACTIVE_FEED_LIVE_FACTS } from './feed-live-facts'

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
    liveFacts: INACTIVE_FEED_LIVE_FACTS,
    selectedSessionId: 'catalog',
    onOpenEvidence: fn(),
    onJumpToLatestChange: fn(),
    onOpenSession: fn(),
    onStalledChange: fn(),
    onRetryFeed: fn(),
    onAnswerQuestion: fn(),
    answeringQuestionId: null,
    questionFailure: () => null,
  },
} satisfies Meta<typeof BasicFeed>
export default meta
type Story = StoryObj<typeof BasicFeed>

function catalogFeed(content: FeedContent): SessionFeed {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: content.id,
    sessionId: 'catalog',
    chainId: 'catalog',
    revision: content.id,
    content: [content],
    rows: groupToolRuns(projectLiveFeedRows([content], [])),
  }
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
export const Tool = kindStory(
  {
    kind: 'tool',
    id: 'tool',
    callId: 'call-1',
    name: 'Bash',
    status: 'running',
    input: { command: 'bun test' },
    output: null,
    summary: null,
    presentation: { kind: 'command', label: 'Run the Feed tests' },
  },
  'Run the Feed tests',
)
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
export const Context = kindStory(
  { kind: 'context', id: 'context', source: 'environment', text: 'Workspace ready' },
  'Workspace ready',
)
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
