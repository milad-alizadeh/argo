import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import type { SessionDelegation, SessionShellCommand } from '@/core/sessions/models'
import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionComposer } from '../components/SessionComposer'
import { SessionInspector } from '../components/SessionInspector'
import { SessionsSidebarContent } from '../components/SessionsSidebar'
import { SessionWorkButtons } from '../components/SessionWorkButtons'
import { SessionWorkInspectorHeader } from '../components/SessionWorkInspectorHeader'
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
    cwd: '/workspace/argo/.claude/worktrees/ticket-1846-composer',
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

function ReviewSidebar({
  onSelect,
  selectedSessionId,
}: {
  onSelect: (sessionId: string) => void
  selectedSessionId: string
}) {
  return (
    <SessionsSidebarContent
      onSelect={onSelect}
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
  )
}

function ReviewInspector({
  delegation,
  shell,
}: {
  delegation: SessionDelegation | null
  shell: SessionShellCommand | null
}) {
  return (
    <SessionInspector
      activeEvidenceId={null}
      delegation={delegation}
      delegationFeed={delegation === null ? null : feedFor(delegation.id)}
      evidence={null}
      sessionId={null}
      handoff={null}
      onOpenEvidence={() => {}}
      onOpenSession={() => {}}
      shell={shell}
      shellOutput={'Checked 187 files.\ncheck:design-tokens — clean.\n'}
    />
  )
}

function ReviewInspectorBar({
  delegation,
  shell,
}: {
  delegation: SessionDelegation | null
  shell: SessionShellCommand | null
}) {
  if (shell !== null) return <SessionWorkInspectorHeader work={{ kind: 'shell', command: shell }} />
  if (delegation !== null) {
    return <SessionWorkInspectorHeader work={{ kind: 'delegation', delegation }} />
  }
  return null
}

function ReviewScreen({ initialSessionId = 'composer-review' }: { initialSessionId?: string }) {
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId)
  // The header's picks drive a real inspector, so the story shows what picking a row opens.
  const [picked, setPicked] = useState<{ id: string; count: number } | null>(null)
  const pick = (id: string) => setPicked((last) => ({ id, count: (last?.count ?? 0) + 1 }))
  const session = SESSION_ROSTER.find(({ id }) => id === selectedSessionId)
  const feed = feedFor(selectedSessionId)
  if (session === undefined) return null
  const delegation = session.delegations.find(({ id }) => id === picked?.id) ?? null
  const shell = session.shell.find(({ id }) => id === picked?.id) ?? null

  return (
    <CockpitShell
      sidebar={
        <ReviewSidebar onSelect={setSelectedSessionId} selectedSessionId={selectedSessionId} />
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
        onRetryFeed={() => {}}
        headerControls={
          <SessionWorkButtons
            delegations={session.delegations}
            onSelectDelegation={pick}
            onSelectShell={pick}
            selectedDelegationId={delegation?.id ?? null}
            selectedShellId={shell?.id ?? null}
            shell={session.shell}
          />
        }
        session={session}
        inspector={<ReviewInspector delegation={delegation} shell={shell} />}
        inspectorBar={<ReviewInspectorBar delegation={delegation} shell={shell} />}
        defaultInspectorCollapsed
        inspectorReveal={picked === null ? undefined : `${picked.id}#${picked.count}`}
        isRunning={session.status === 'running'}
        onOpenEvidence={() => {}}
        onOpenSession={() => {}}
        onAnswerQuestion={() => {}}
        answeringQuestionId={null}
        questionFailure={() => null}
        selectedSessionId={selectedSessionId}
      />
    </CockpitShell>
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
  history.scrollTo({ top: 0 })

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

function expectHeaderActionsAtTrailingEdge(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const headerControls = canvasElement.querySelector<HTMLElement>(
    '[data-component="SessionHeaderControls"]',
  )
  const subagents = canvas.getByRole('button', { name: /^Subagents/ })
  const shell = canvas.getByRole('button', { name: /^Shell/ })
  const inspector = canvas.getByRole('button', { name: 'Open Session inspector' })
  if (headerControls === null) throw new Error('The Session header controls are absent.')

  expect(subagents).toHaveAccessibleName(/^Subagents/)
  expect(shell).toHaveAccessibleName(/^Shell/)
  expect(headerControls.getBoundingClientRect().right).toBeLessThanOrEqual(
    inspector.getBoundingClientRect().left -
      Number.parseFloat(getComputedStyle(headerControls).getPropertyValue('gap')),
  )
}

async function expectCollapsedSidebarDoesNotCoverSessionHeader(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
  const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
  const title = canvas.getByRole('heading', { name: 'Finish Session composer review' })
  expect(title.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    opener.getBoundingClientRect().right +
      Number.parseFloat(getComputedStyle(title).getPropertyValue('--spacing-shell-tight')),
  )
  await userEvent.click(opener)
  await expect(canvas.getByLabelText('Sessions sidebar')).toBeVisible()
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
    await expect(
      canvas.getByRole('heading', { name: 'Finish Session composer review' }),
    ).toBeVisible()
    await expect(canvas.getByText('ticket-1846-composer')).toBeVisible()
    expectHeaderActionsAtTrailingEdge(canvasElement)
    await expectCollapsedSidebarDoesNotCoverSessionHeader(canvasElement)
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

    // Picking a Subagent in the header opens the collapsed inspector on its transcript.
    await userEvent.click(canvas.getByRole('button', { name: /^Subagents/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Subagent' })).toBeInTheDocument(),
    )
    const inspector = canvas.getByRole('region', { name: 'Subagent' })
    await expect(inspector).toBeVisible()
    expect(inspector.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(canvas.getByRole('button', { name: 'Collapse Session inspector' })).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /^Subagents/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
    await expect(inspector).toBeVisible()
    expect(inspector.getBoundingClientRect().width).toBeGreaterThan(0)
  },
}

export const ComposerStaysFixed: Story = {
  render: () => <ReviewScreen />,
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

export const SharedCheckout: Story = {
  render: () => <ReviewScreen initialSessionId="shortcut-review" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Add Markdown typing shortcuts' }),
    ).toBeVisible()
    expect(canvas.queryByText('ticket-1846-composer')).not.toBeInTheDocument()
  },
}

export const NarrowHeader: Story = {
  render: () => (
    <div className="h-dvh w-[calc(var(--size-navigation-rail)+var(--size-cockpit-sidebar-min)+var(--size-cockpit-content-min))]">
      <ReviewScreen />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Finish Session composer review' }),
    ).toBeVisible()
    await expect(canvas.getByText('ticket-1846-composer')).toBeVisible()
    expectHeaderActionsAtTrailingEdge(canvasElement)
  },
}
