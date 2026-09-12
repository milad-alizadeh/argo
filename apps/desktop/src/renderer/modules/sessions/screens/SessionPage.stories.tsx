import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { NavigationRail } from '../../cockpit/components/NavigationRail'
import { feedStory, sessionsStory, workingSessionStory } from '../components/stories.fixtures'
import type { SessionId } from '../types'
import { SessionPage } from './SessionPage'

const meta: Meta<typeof SessionPage> = {
  title: 'Sessions/Screens/Sessions',
  component: SessionPage,
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop' } },
  args: {
    failure: null,
    feedFailure: null,
    loading: false,
    onSelect: fn(),
    onReread: fn(),
    projectName: 'argo',
  },
  // The screen takes its height from the surface it is given, so a story gives it one.
  decorators: [
    (Story) => (
      <div className="flex h-[800px]">
        <NavigationRail destination="Sessions" onNavigate={() => undefined} />
        <div className="min-w-0 flex-1">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionPage>

export const Reading: Story = {
  args: { sessions: sessionsStory, selectedSessionId: workingSessionStory.id, feed: feedStory },
  render: function ReadingStory(args) {
    const [selectedSessionId, setSelectedSessionId] = useState<SessionId>(workingSessionStory.id)
    const feed = {
      ...feedStory,
      requestId: `feed-${selectedSessionId}`,
      revision: `feed-${selectedSessionId}`,
      sessionId: selectedSessionId,
      chainId: selectedSessionId,
    }
    return (
      <SessionPage
        {...args}
        feed={feed}
        onSelect={setSelectedSessionId}
        selectedSessionId={selectedSessionId}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Every delegation finished/ }))
    await expect(canvas.getByRole('heading', { name: 'Pick the ink' })).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: /Every delegation finished/ }),
    ).toHaveAttribute('aria-current', 'true')
    await expect(
      canvasElement.querySelector('[data-active="true"] .feed__viewport'),
    ).toHaveAttribute('data-session', 'askPending')
  },
}
export const Running: Story = {
  args: {
    sessions: sessionsStory,
    selectedSessionId: workingSessionStory.id,
    feed: {
      ...feedStory,
      sessionId: workingSessionStory.id,
      chainId: workingSessionStory.id,
    },
    composerContent: {
      queued: [
        'Update the empty state, then check the composer at compact widths.',
        'Capture the selected direction for implementation.',
      ],
      attachments: [
        { name: 'workspace.jpg', kind: 'JPG file' },
        { name: 'Composer.tsx', kind: 'TSX file' },
        { name: 'tokens.css', kind: 'CSS file' },
      ],
      usagePercentage: 54,
      contextUsed: 148,
      contextTotal: 200,
      runLabel: 'Codex · GPT-5.6 Sol · Medium',
      modeLabel: 'Full access',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: workingSessionStory.title?.text }),
    ).toBeVisible()
    await expect(canvas.getByRole('complementary', { name: 'Session inspector' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Hide inspector' }))
    await expect(canvas.queryByRole('complementary', { name: 'Session inspector' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Show inspector' }))
    await expect(canvas.getByRole('complementary', { name: 'Session inspector' })).toBeVisible()

    const roster = canvas.getByRole('complementary', { name: 'Sessions' })
    const resizeHandle = canvas.getByRole('separator')
    const start = roster.getBoundingClientRect()
    await expect(Math.round(start.width)).toBe(336)
    await userEvent.pointer([
      { target: resizeHandle, coords: { clientX: start.right, clientY: start.top + 100 }, keys: '[MouseLeft>]' },
      { target: resizeHandle, coords: { clientX: start.right + 240, clientY: start.top + 100 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(Math.round(roster.getBoundingClientRect().width)).toBe(460)
    const widened = roster.getBoundingClientRect()
    await userEvent.pointer([
      { target: resizeHandle, coords: { clientX: widened.right, clientY: widened.top + 100 }, keys: '[MouseLeft>]' },
      { target: resizeHandle, coords: { clientX: widened.left - 240, clientY: widened.top + 100 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(Math.round(roster.getBoundingClientRect().width)).toBe(336)
    await userEvent.click(canvas.getByRole('button', { name: 'Hide Sessions' }))
    await expect(canvas.queryByRole('complementary', { name: 'Sessions' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Show Sessions' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Show Sessions' }))
    await expect(canvas.getByRole('complementary', { name: 'Sessions' })).toBeVisible()
  },
}

export const NoSessions: Story = {
  args: { sessions: [], selectedSessionId: null, feed: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Sessions on this machine')).toBeVisible()
    await expect(canvas.queryByRole('complementary', { name: 'Session inspector' })).toBeNull()
  },
}

export const RosterFailure: Story = {
  args: {
    sessions: sessionsStory,
    selectedSessionId: workingSessionStory.id,
    feed: {
      ...feedStory,
      sessionId: workingSessionStory.id,
      chainId: workingSessionStory.id,
    },
    failure: 'Argo cannot read the Claude transcript folder.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(canvas.getByRole('option', { selected: true })).toBeVisible()
  },
}

export const FeedFailure: Story = {
  args: {
    sessions: sessionsStory.map((session) =>
      session.id === workingSessionStory.id ? { ...session, status: 'idle' as const } : session,
    ),
    selectedSessionId: workingSessionStory.id,
    feed: null,
    feedFailure: 'Argo cannot find this Session.',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      "Argo cannot read this Session's history.",
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Read again' }))
    await expect(args.onReread).toHaveBeenCalled()
  },
}

export const RosterOpen: Story = {
  ...Running,
  globals: { viewport: { value: 'narrow' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const workspace = canvasElement.querySelector<HTMLElement>('[data-component="SessionWorkspace"]')
    await expect(workspace).not.toBeNull()
    const closedWorkspace = workspace?.getBoundingClientRect()
    await userEvent.click(canvas.getByRole('button', { name: 'Show Sessions' }))
    const roster = canvas.getByRole('complementary', { name: 'Sessions' })
    await expect(roster).toBeVisible()
    await expect(roster.getBoundingClientRect().right).toBeLessThanOrEqual(
      workspace?.getBoundingClientRect().left ?? 0,
    )
    await expect(workspace?.getBoundingClientRect().width ?? 0).toBeLessThan(
      closedWorkspace?.width ?? 0,
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Hide Sessions' }))
    await expect(canvas.queryByRole('complementary', { name: 'Sessions' })).toBeNull()
    await expect(Math.round(workspace?.getBoundingClientRect().width ?? 0)).toBe(
      Math.round(closedWorkspace?.width ?? 0),
    )
  },
}
