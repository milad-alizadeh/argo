import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import type { SessionFeed } from '../types'

import { BasicFeed } from './BasicFeed'

const COMPACTION_STARTED_AT = '2026-09-13T22:01:00.000Z'

const feed = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-compaction',
  sessionId: 'compaction',
  chainId: 'compaction',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prompt', role: 'user', text: 'Condense the Session.' }],
} satisfies SessionFeed

const meta: Meta<typeof BasicFeed> = {
  title: 'Sessions/Feed/Compaction Marker',
  component: BasicFeed,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
  args: { failure: null, feed, onOpenEvidence: () => {}, selectedSessionId: 'compaction' },
}

export default meta
type Story = StoryObj<typeof BasicFeed>

export const AwaitingTerminalProgress: Story = {
  args: { compactionStartedAt: COMPACTION_STARTED_AT },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Compacting conversation',
    )
  },
}

export const ObservedTerminalProgress: Story = {
  args: {
    compactionPercentage: 22,
    compactionStartedAt: COMPACTION_STARTED_AT,
    compactionTokens: '10.1k tokens',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Compacting conversation')
    await expect(canvas.getByText('22%')).toBeVisible()
    await expect(canvas.queryByRole('progressbar')).toBeNull()
  },
}

export const ConversationCompacted: Story = {
  args: {
    feed: { ...feed, rows: [...feed.rows, { shape: 'marker', id: 'done', marker: 'compacted' }] },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Conversation compacted')).toBeVisible()
  },
}

export const Interrupted: Story = {
  args: {
    feed: {
      ...feed,
      rows: [...feed.rows, { shape: 'marker', id: 'interrupted', marker: 'interrupted' }],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Interrupted')).toBeVisible()
  },
}
