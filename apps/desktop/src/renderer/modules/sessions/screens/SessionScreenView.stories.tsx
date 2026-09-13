import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionComposer } from '../components/SessionComposer'
import { SessionFacts } from '../components/SessionScreenDetails'
import { SessionsSidebarContent } from '../components/SessionsSidebar'
import { RICH_MARKDOWN } from '../feed/content/feedSamples'
import { sessionRosterRow } from '../session-fixtures'
import type { Session, SessionFeed } from '../types'
import { SessionScreenView, SessionShell } from './SessionScreenView'

const SESSION_ROSTER = [
  sessionRosterRow({
    id: 'composer-review',
    posture: 'external',
    title: { text: 'Finish Session composer review', source: 'first-prompt' },
    status: 'running',
    cwd: '/workspace/argo',
    branch: 'argo/#1846-composer',
    updatedAt: '2026-09-13T15:50:00Z',
    turnStartedAt: '2026-09-13T15:42:00Z',
    activity: { tool: 'Bash', target: 'bun run quality' },
    plan: {
      state: 'available',
      entries: [
        { content: 'Review the composer surface', position: 0, status: 'completed' },
        { content: 'Check the full Session screen', position: 1, status: 'in_progress' },
        { content: 'Record the visual review', position: 2, status: 'pending' },
      ],
    },
    delegations: [{ id: 'interface-review', label: 'Interface review', landed: false }],
    shell: [{ id: 'quality', command: 'bun run quality', background: false }],
    pullRequest: { number: 1846, url: 'https://example.com/pull/1846', repository: 'argo' },
    contextTokens: 54_000,
    spentTokens: 11_200,
  }),
  sessionRosterRow({
    id: 'shortcut-review',
    cli: 'codex',
    posture: 'managed',
    title: { text: 'Add Markdown typing shortcuts', source: 'summarised' },
    status: 'idle',
    cwd: '/workspace/argo',
    branch: 'argo/#1847-inline-references',
    updatedAt: '2026-09-13T15:28:00Z',
    contextTokens: 21_000,
    spentTokens: 4_600,
  }),
  sessionRosterRow({
    id: 'feed-review',
    posture: 'external',
    title: { text: 'Review transcript rendering', source: 'custom' },
    status: 'permission',
    cwd: '/workspace/argo',
    updatedAt: '2026-09-13T15:18:00Z',
    turnStartedAt: '2026-09-13T15:15:00Z',
    activity: { tool: 'Read', target: 'FeedDocument.tsx' },
    contextTokens: 18_000,
    spentTokens: 2_900,
  }),
] satisfies Session[]

function feedFor(sessionId: string) {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: 'screen-review-feed',
    sessionId,
    chainId: sessionId,
    revision: `screen-review-${sessionId}`,
    rows: [
      {
        shape: 'prose',
        id: 'review-request',
        role: 'user',
        text: 'Use the approved prototype to review the Session composer in context.',
      },
      {
        shape: 'prose',
        id: 'review-response',
        role: 'assistant',
        text: RICH_MARKDOWN,
      },
      {
        shape: 'thought',
        id: 'review-thought',
        text: 'The transcript keeps the feed, plan, and composer visible together.',
      },
    ],
  } satisfies SessionFeed
}

function ReviewScreen() {
  const [selectedSessionId, setSelectedSessionId] = useState('composer-review')
  const session = SESSION_ROSTER.find(({ id }) => id === selectedSessionId)
  const feed = feedFor(selectedSessionId)
  if (session === undefined) return null

  return (
    <CockpitShell
      sidebar={
        <SessionsSidebarContent
          onSelect={setSelectedSessionId}
          roster={{
            version: 1,
            type: 'session.listed',
            requestId: 'screen-review-roster',
            sessions: SESSION_ROSTER,
            filesFound: SESSION_ROSTER.length,
            filesRead: SESSION_ROSTER.length,
            filesUnreadable: 0,
          }}
          rosterError={null}
          selectedSessionId={selectedSessionId}
        />
      }
    >
      <SessionShell
        composer={
          <SessionComposer
            onSend={async () => true}
            plan={session.plan}
            sessionId={selectedSessionId}
          />
        }
        feed={feed}
        feedError={null}
        inspector={<SessionFacts session={session} />}
        onOpenEvidence={() => {}}
        selectedSessionId={selectedSessionId}
      />
    </CockpitShell>
  )
}

function expectTranscriptRowsDoNotOverlap(canvasElement: HTMLElement) {
  const sessionHistory = within(canvasElement).getByLabelText('Session history')
  const promptRow = sessionHistory.querySelector<HTMLElement>('[data-feed-row="review-request"]')
  const responseRow = sessionHistory.querySelector<HTMLElement>('[data-feed-row="review-response"]')
  if (promptRow === null || responseRow === null)
    throw new Error('The review transcript is absent.')
  expect(responseRow.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    promptRow.getBoundingClientRect().bottom,
  )
}

function expectSessionsSidebarIsOpen(canvasElement: HTMLElement) {
  expect(
    within(canvasElement).getByLabelText('Sessions sidebar').getBoundingClientRect().width,
  ).toBeGreaterThan(0)
}

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen',
  component: SessionScreenView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionScreenView>

export const Open: Story = {
  render: () => <ReviewScreen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole('button', { name: /Finish Session composer review/ }),
    ).toHaveAttribute('aria-current', 'page')
    await waitFor(() =>
      expect(canvas.getByLabelText('Session history')).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectTranscriptRowsDoNotOverlap(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument(),
    )

    const openInspector = canvas.queryByRole('button', { name: 'Open Session inspector' })
    if (openInspector) await userEvent.click(openInspector)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Collapse Session inspector' }),
      ).toBeInTheDocument(),
    )
    const inspectorControl = canvas.getByRole('button', { name: 'Collapse Session inspector' })
    const inspectorControlLeft = inspectorControl.getBoundingClientRect().left
    await userEvent.click(inspectorControl)
    expectSessionsSidebarIsOpen(canvasElement)

    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeInTheDocument(),
    )
    const openInspectorControl = canvas.getByRole('button', { name: 'Open Session inspector' })
    await expect(openInspectorControl.getBoundingClientRect().left).toBe(inspectorControlLeft)
    await userEvent.click(openInspectorControl)
    await expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument()
    const expandInspectorControl = canvas.getByRole('button', { name: 'Expand Session sidebar' })
    const expandInspectorControlLeft = expandInspectorControl.getBoundingClientRect().left
    await userEvent.click(expandInspectorControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Session sidebar' })).toBeInTheDocument(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Restore Session sidebar' }).getBoundingClientRect().left,
    ).toBe(expandInspectorControlLeft)

    await userEvent.click(canvas.getByRole('button', { name: 'Restore Session sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument(),
    )
  },
}
