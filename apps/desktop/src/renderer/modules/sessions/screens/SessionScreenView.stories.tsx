import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionComposer } from '../components/SessionComposer'
import { SessionsSidebarContent } from '../components/SessionsSidebar'
import { SessionWorkInspector } from '../components/SessionWorkInspector'
import { RICH_MARKDOWN } from '../feed/content/feedSamples'
import { sessionDelegation, sessionRosterRow, sessionShellCommand } from '../session-fixtures'
import type { Session, SessionFeed } from '../types'
import { SessionScreenView } from './SessionScreenView'
import { SessionShell } from './SessionShell'

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
    delegations: [
      sessionDelegation({
        id: 'interface-review',
        label: 'Interface review',
        startedAt: '2026-09-13T15:44:00Z',
      }),
    ],
    shell: [sessionShellCommand({ id: 'quality', command: 'bun run quality' })],
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

const SESSION_HISTORY_LABEL = 'Session history'
const SCROLL_HISTORY_TO_START_LABEL = 'Scroll Session history to start'

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
        activeEvidenceId={null}
        composer={
          <SessionComposer
            onSend={async () => true}
            plan={session.plan}
            sessionId={selectedSessionId}
          />
        }
        feed={feed}
        feedError={null}
        inspector={
          <SessionWorkInspector
            delegations={session.delegations}
            shell={session.shell}
            selectedDelegationId={null}
            onSelectDelegation={() => {}}
            selectedShellId={null}
            onSelectShell={() => {}}
          />
        }
        isRunning={session.status === 'running'}
        onOpenEvidence={() => {}}
        onAnswerQuestion={() => {}}
        answeringQuestionId={null}
        questionFailure={() => null}
        selectedSessionId={selectedSessionId}
      />
    </CockpitShell>
  )
}

function ScrollableReviewScreen() {
  const scrollHistoryToStart = () => {
    document
      .querySelector<HTMLElement>(`[aria-label="${SESSION_HISTORY_LABEL}"]`)
      ?.scrollTo({ top: 0 })
  }

  return (
    <div className="relative h-full">
      <ReviewScreen />
      <Button
        className="absolute top-2 left-2 z-10"
        type="button"
        variant="secondary"
        onClick={scrollHistoryToStart}
      >
        {SCROLL_HISTORY_TO_START_LABEL}
      </Button>
    </div>
  )
}

function expectTranscriptRowsDoNotOverlap(canvasElement: HTMLElement) {
  const sessionHistory = within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)
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

async function expectComposerStaysInPlaceWhileHistoryScrolls(canvasElement: HTMLElement) {
  const composer = within(canvasElement).getByLabelText('Session composer')
  const history = within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)
  const before = composer.getBoundingClientRect()
  const activeDocument = canvasElement.querySelector<HTMLElement>(
    '.feed__document[data-active="true"]',
  )
  if (activeDocument === null) throw new Error('The active feed document is absent.')
  const viewport = activeDocument.querySelector<HTMLElement>('.feed__viewport')
  if (viewport === null) throw new Error('The active feed viewport is absent.')
  const finalFeedLine = within(viewport).getByText(
    'The transcript keeps the feed, plan, and composer visible together.',
  )

  expect(history.scrollHeight).toBeGreaterThan(history.clientHeight)
  expect(history.scrollTop).toBeGreaterThan(0)
  expect(history.getBoundingClientRect().bottom).toBeGreaterThan(before.top)
  expect(finalFeedLine.getBoundingClientRect().bottom).toBeLessThanOrEqual(before.top)
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: SCROLL_HISTORY_TO_START_LABEL }),
  )

  expect(history.scrollTop).toBe(0)
  expect(composer.getBoundingClientRect()).toEqual(before)
}

function expectContextBarInset(canvasElement: HTMLElement) {
  const composer = within(canvasElement).getByLabelText('Session composer')
  const workspace = within(canvasElement).getByLabelText('Session workspace')
  const card = composer.querySelector<HTMLElement>('[data-component="ComposerCard"]')
  const contextBar = composer.querySelector<HTMLElement>('[data-component="SessionContextBar"]')
  const fade = workspace.querySelector<HTMLElement>('[data-component="SessionComposerFade"]')
  if (card === null || contextBar === null || fade === null)
    throw new Error('The attached composer surfaces are absent.')

  const gutter = Number.parseFloat(
    getComputedStyle(composer).getPropertyValue('--spacing-shell-gutter'),
  )
  expect(contextBar.getBoundingClientRect().left - card.getBoundingClientRect().left).toBeCloseTo(
    gutter,
    1,
  )
  expect(card.getBoundingClientRect().right - contextBar.getBoundingClientRect().right).toBeCloseTo(
    gutter,
    1,
  )
  expect(getComputedStyle(contextBar).boxShadow).toBe(getComputedStyle(card).boxShadow)
  const composerBounds = composer.getBoundingClientRect()
  expect(fade.getBoundingClientRect().top).toBeCloseTo(composerBounds.top, 1)
  expect(fade.getBoundingClientRect().bottom).toBeCloseTo(
    workspace.getBoundingClientRect().bottom,
    1,
  )
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
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectTranscriptRowsDoNotOverlap(canvasElement)

    const openInspector = canvas.queryByRole('button', { name: 'Open Session inspector' })
    if (openInspector) await userEvent.click(openInspector)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Collapse Session inspector' }),
      ).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    expectSessionsSidebarIsOpen(canvasElement)
  },
}

export const ComposerStaysFixed: Story = {
  render: () => <ScrollableReviewScreen />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    await expectComposerStaysInPlaceWhileHistoryScrolls(canvasElement)
    expectContextBarInset(canvasElement)
  },
}
