import type { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor, within } from 'storybook/test'

import type { SessionError, SessionFeed } from '../types'

import { BasicFeed } from './BasicFeed'

const feed = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-feed',
  sessionId: 'prose',
  chainId: 'prose',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prose-1', role: 'assistant', text: 'The matching Session Feed.' }],
} satisfies SessionFeed

const unavailable = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-feed-unavailable',
  code: 'missing-session',
  message: 'Argo cannot find this Session.',
} satisfies SessionError

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
  args: { feed, failure: null, selectedSessionId: 'prose' },
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
export const Loading: Story = { args: { feed: null, failure: null, selectedSessionId: 'prose' } }
export const Empty: Story = { args: { feed: { ...feed, rows: [] }, failure: null } }
export const Unavailable: Story = { args: { feed: null, failure: unavailable } }
export const ReadFailure: Story = { args: { feed: null, failure: readFailure } }
