import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useCallback, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router'
import { expect, fireEvent, screen, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import type { SessionShellCommand } from '@/domains/sessions/api/session-shell-command'
import { sessionRow, sessionShellCommand, sessionSubagent } from '@/mocks/sessions/session-rows'
import { sessionSelectionHost } from '@/mocks/sessions/session-selection-host.fixture'
import { sessionListSubscribe } from '@/mocks/sessions/session-story-host'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import { ComposerForm } from '../composer/layout/composer-form'
import { RICH_MARKDOWN } from '../feed/content/feed-samples'
import { SessionInspector } from '../inspector/session-inspector'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import type { SessionSubagent } from '../model/models'
import { SessionList, type SessionListActions } from '../session-list/session-list'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import type { Session, SessionFeed } from '../types'
import { SessionWorkButtons } from '../work/session-work-buttons'
import { SessionWorkInspectorHeader } from '../work/session-work-inspector-header'
import type { SessionShellOutput } from '../work/types'
import { SessionScreenView } from './session-screen-view'
import { type ListedWorkspace, sessionWorkspaceIdentity } from './session-screen-workspace'
import { SessionShell } from './session-shell'

const SESSION_ROSTER = [
  sessionRow({
    id: 'composer-review',
    posture: 'external',
    title: { text: 'Finish Session composer review', source: 'first-prompt' },
    status: 'running',
    cwd: '/workspace/argo/.claude/worktrees/ticket-1846-composer',
    branch: 'argo/#1846-composer',
    updatedAt: '2026-09-13T15:50:00Z',
    turnStartedAt: '2026-09-13T15:42:00Z',
    activity: {
      label: 'Ran bun run quality',
      kind: 'command',
      open: false,
      tool: 'Bash',
      target: 'bun run quality',
    },
    plan: {
      state: 'available',
      entries: [
        { content: 'Review the composer surface', position: 0, status: 'completed' },
        { content: 'Check the full Session screen', position: 1, status: 'in_progress' },
        { content: 'Record the visual review', position: 2, status: 'pending' },
      ],
    },
    subagents: [
      sessionSubagent({
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
  sessionRow({
    id: 'shortcut-review',
    harness: 'codex',
    posture: 'live',
    title: { text: 'Add Markdown typing shortcuts', source: 'summarised' },
    status: 'idle',
    cwd: '/workspace/argo',
    branch: 'argo/#1847-inline-references',
    updatedAt: '2026-09-13T15:28:00Z',
    shell: [sessionShellCommand({ id: 'codex-command', command: 'bun run typecheck' })],
    contextTokens: 21_000,
    spentTokens: 4_600,
  }),
  sessionRow({
    id: 'feed-review',
    posture: 'external',
    title: { text: 'Review transcript rendering', source: 'custom' },
    status: 'permission',
    cwd: '/workspace/argo',
    updatedAt: '2026-09-13T15:18:00Z',
    turnStartedAt: '2026-09-13T15:15:00Z',
    activity: {
      label: 'Read feed-document.tsx',
      kind: 'read',
      open: false,
      tool: 'Read',
      target: 'feed-document.tsx',
    },
    contextTokens: 18_000,
    spentTokens: 2_900,
  }),
] satisfies Session[]

const SESSION_HISTORY_LABEL = 'Session history'
const JUMP_TO_LATEST_ROWS = Array.from({ length: 36 }, (_unused, index) => ({
  shape: 'prose' as const,
  id: `jump-to-latest-${index}`,
  role: 'assistant' as const,
  text: `History row ${index + 1} keeps the Jump to latest control visible while the reader is away from the end.`,
}))

function feedFor(sessionId: string) {
  return {
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
        shape: 'prose',
        id: 'review-summary',
        role: 'assistant',
        text: 'The transcript keeps the feed, plan, and composer visible together.',
      },
    ],
  } satisfies SessionFeed
}

function delegationFeedFor(delegation: SessionSubagent) {
  const sessionId = `composer-review#${delegation.id}`
  return {
    sessionId,
    chainId: sessionId,
    revision: `screen-review-${delegation.id}`,
    rows: [
      {
        shape: 'prose',
        id: 'delegation-brief',
        role: 'user',
        text: 'Use the approved prototype to review the Session composer in context.',
      },
      ...Array.from({ length: 18 }, (_unused, index) => ({
        shape: 'prose' as const,
        id: `delegation-review-${index}`,
        role: 'assistant' as const,
        text: `Review finding ${index + 1}: The inspector keeps a complete implementation report readable after it closes and reopens, including long evidence, acceptance criteria, and release notes.`,
      })),
    ],
  } satisfies SessionFeed
}

// The Session list reads its own Sessions now (#2284), so a screen review stubs the read rather than
// handing it a fixed roster prop.
const NOOP_SESSION_LIST_ACTIONS: SessionListActions = {
  onArchiveSelected: () => {},
  onNew: () => {},
  onOpenTicket: () => {},
  onRename: async (_session, name) => name,
  onSelect: () => {},
}

function withListedSessions(sessions: Session[]) {
  const before = window.argo
  window.argo = {
    ...before,
    trpcSubscribe: sessionListSubscribe(before.trpcSubscribe, () => sessions),
  }
  return () => {
    window.argo = before
  }
}

function ProductionSessionSelectionScreen() {
  return (
    <Routes>
      <Route
        path="/projects/:projectId/sessions/:sessionId"
        element={
          <div className="h-dvh w-full">
            <AppShell leftHeader={<ProjectSwitcher />} sidebar={<SessionsSidebar />}>
              <SessionScreenView />
            </AppShell>
          </div>
        }
      />
      <Route
        path="*"
        element={<Navigate replace to="/projects/project-1/sessions/composer-review" />}
      />
    </Routes>
  )
}

function ReviewSidebar({
  onSelect,
  selectedSessionId,
  titleText,
}: {
  onSelect: (sessionId: string) => void
  selectedSessionId: string
  titleText?: string
}) {
  withListedSessions(
    SESSION_ROSTER.map((session) =>
      sessionWithTitle(session, session.id === 'composer-review' ? titleText : undefined),
    ),
  )
  return (
    <SessionList
      actions={{ ...NOOP_SESSION_LIST_ACTIONS, onSelect }}
      projectId="project-1"
      selectedSessionId={selectedSessionId}
    />
  )
}

function ReviewInspector({
  delegation,
  shell,
  shellOutput,
}: {
  delegation: SessionSubagent | null
  shell: SessionShellCommand | null
  shellOutput: SessionShellOutput
}) {
  return (
    <SessionInspector
      activeEvidenceId={null}
      delegation={delegation}
      delegationFeed={delegation === null ? null : delegationFeedFor(delegation)}
      delegationFeedError={null}
      evidence={null}
      sessionId={null}
      handoff={null}
      onOpenEvidence={() => {}}
      onRetryDelegationFeed={() => {}}
      shell={shell}
      shellOutput={shellOutput}
    />
  )
}

function ReviewInspectorBar({
  delegation,
  shell,
}: {
  delegation: SessionSubagent | null
  shell: SessionShellCommand | null
}) {
  if (shell !== null) return <SessionWorkInspectorHeader work={{ kind: 'shell', command: shell }} />
  if (delegation !== null) {
    return (
      <SessionWorkInspectorHeader
        work={{ kind: 'delegation', delegation, usage: { tokens: null, model: null } }}
      />
    )
  }
  return null
}

function reviewInspectorReveal(
  picked: { id: string; count: number } | null,
  shell: SessionShellCommand | null,
  shellOutput: SessionShellOutput,
) {
  return (
    workInspectorReveal(
      picked === null ? null : `${picked.id}#${picked.count}`,
      shell,
      shellOutput,
    ) ?? undefined
  )
}

function ReviewScreen({
  initialSessionId = 'composer-review',
  rows = null,
  shellOutput = { state: 'available', tail: 'Checked 187 files.\ncheck:design-tokens — clean.\n' },
  showPlan = true,
  composerRunning = false,
  permissionPrompt = null,
  titleText,
  workspaceId = null,
  workspaces = [],
}: {
  initialSessionId?: string
  rows?: SessionFeed['rows'] | null
  shellOutput?: SessionShellOutput
  showPlan?: boolean
  composerRunning?: boolean
  permissionPrompt?: ReactNode
  titleText?: string
  workspaceId?: string | null
  workspaces?: readonly ListedWorkspace[]
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId)
  const [jumpToLatest, setJumpToLatest] = useState<{
    action: () => void
    sessionId: string
  } | null>(null)
  const onJumpToLatestChange = useCallback((sessionId: string, action: (() => void) | null) => {
    setJumpToLatest((current) => {
      if (action !== null) return { action, sessionId }
      return current?.sessionId === sessionId ? null : current
    })
  }, [])
  // The header's picks drive a real inspector, so the story shows what picking a row opens.
  const [picked, setPicked] = useState<{ id: string; count: number } | null>(null)
  const pick = (id: string) => setPicked((last) => ({ id, count: (last?.count ?? 0) + 1 }))
  const session = SESSION_ROSTER.find(({ id }) => id === selectedSessionId)
  const feed = rows === null ? feedFor(selectedSessionId) : { ...feedFor(selectedSessionId), rows }
  if (session === undefined) return null
  const headerSession = sessionWithTitle({ ...session, workspaceId }, titleText)
  const workspaceIdentity = sessionWorkspaceIdentity(headerSession, workspaces)

  return (
    <ReviewContent
      composerRunning={composerRunning}
      permissionPrompt={permissionPrompt}
      feed={feed}
      headerSession={headerSession}
      jumpToLatest={jumpToLatest?.action ?? null}
      onJumpToLatestChange={onJumpToLatestChange}
      onSelectSessionId={setSelectedSessionId}
      pick={pick}
      picked={picked}
      selectedSessionId={selectedSessionId}
      session={session}
      shellOutput={shellOutput}
      showPlan={showPlan}
      titleText={titleText}
      workspaceIdentity={workspaceIdentity}
    />
  )
}

function ReviewContent({
  composerRunning,
  permissionPrompt,
  feed,
  headerSession,
  jumpToLatest,
  onJumpToLatestChange,
  onSelectSessionId,
  pick,
  picked,
  selectedSessionId,
  session,
  shellOutput,
  showPlan,
  titleText,
  workspaceIdentity,
}: {
  composerRunning: boolean
  permissionPrompt: ReactNode
  feed: SessionFeed
  headerSession: Session
  jumpToLatest: (() => void) | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onSelectSessionId: (sessionId: string) => void
  pick: (id: string) => void
  picked: { id: string; count: number } | null
  selectedSessionId: string
  session: Session
  shellOutput: SessionShellOutput
  showPlan: boolean
  titleText: string | undefined
  workspaceIdentity: ReturnType<typeof sessionWorkspaceIdentity>
}) {
  const delegation = session.subagents.find(({ id }) => id === picked?.id) ?? null
  const shell = session.shell.find(({ id }) => id === picked?.id) ?? null

  return (
    <AppShell
      leftHeader={<ProjectSwitcher />}
      sidebar={reviewSidebar(selectedSessionId, onSelectSessionId, titleText)}
    >
      <SessionShell
        activeEvidenceId={null}
        composer={
          <ComposerForm
            isRunning={composerRunning}
            permissionPrompt={permissionPrompt}
            onInterrupt={async () => true}
            onSend={async () => true}
            plan={showPlan ? session.plan : null}
            sessionId={selectedSessionId}
          />
        }
        feed={feed}
        feedError={null}
        onRetryFeed={() => {}}
        headerControls={
          <SessionWorkButtons
            subagents={session.subagents}
            onSelectDelegation={pick}
            onSelectShell={pick}
            selectedDelegationId={delegation?.id ?? null}
            selectedShellId={shell?.id ?? null}
            shell={session.shell}
          />
        }
        jumpToLatest={jumpToLatest}
        onJumpToLatestChange={onJumpToLatestChange}
        session={headerSession}
        workspaceIdentity={workspaceIdentity}
        inspector={
          <ReviewInspector delegation={delegation} shell={shell} shellOutput={shellOutput} />
        }
        inspectorBar={<ReviewInspectorBar delegation={delegation} shell={shell} />}
        defaultInspectorCollapsed
        inspectorReveal={reviewInspectorReveal(picked, shell, shellOutput)}
        running={session.status === 'running'}
        posture={session.posture}
        onOpenEvidence={() => {}}
        onAnswerQuestion={() => {}}
        answeringQuestionId={null}
        questionFailure={() => null}
        selectedSessionId={selectedSessionId}
      />
    </AppShell>
  )
}

function reviewSidebar(
  selectedSessionId: string,
  onSelect: (sessionId: string) => void,
  titleText: string | undefined,
) {
  return (
    <ReviewSidebar
      onSelect={onSelect}
      selectedSessionId={selectedSessionId}
      titleText={titleText}
    />
  )
}

function sessionWithTitle(session: Session, titleText: string | undefined): Session {
  return titleText === undefined
    ? session
    : { ...session, title: { text: titleText, source: 'first-prompt' } }
}

function NewSessionScreen() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  withListedSessions([])
  return (
    <AppShell
      leftHeader={<ProjectSwitcher />}
      sidebar={
        <SessionList
          actions={{
            ...NOOP_SESSION_LIST_ACTIONS,
            onNew: () => setSelectedSessionId('optimistic:new-session'),
            onSelect: setSelectedSessionId,
          }}
          projectId="project-1"
          selectedSessionId={selectedSessionId}
        />
      }
    >
      <SessionShell
        activeEvidenceId={null}
        answeringQuestionId={null}
        composer={
          selectedSessionId === null ? null : (
            <ComposerForm onSend={async () => true} sessionId={selectedSessionId} />
          )
        }
        feed={null}
        feedError={null}
        inspector={null}
        running={false}
        posture={null}
        onAnswerQuestion={() => {}}
        onOpenEvidence={() => {}}
        onRetryFeed={() => {}}
        questionFailure={() => null}
        selectedSessionId={selectedSessionId}
        stallTimeoutMs={50}
      />
    </AppShell>
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

function expectVisibleFeedRowsDoNotOverlap(history: HTMLElement) {
  const rows = [...history.querySelectorAll<HTMLElement>('[data-feed-row]')].filter(
    (row) => row.getBoundingClientRect().height > 0,
  )
  for (const [index, row] of rows.entries()) {
    const previous = rows[index - 1]
    if (previous === undefined) continue
    expect(row.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      previous.getBoundingClientRect().bottom,
    )
  }
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

  expect(history.scrollHeight).toBeGreaterThan(history.clientHeight)
  expect(history.scrollTop).toBeGreaterThan(0)
  expectFeedDoesNotOverlapComposer(canvasElement)
  history.scrollTo({ top: 0 })
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  expect(history.scrollTop).toBe(0)
  expect(composer.getBoundingClientRect()).toEqual(before)
}

function expectFeedDoesNotOverlapComposer(canvasElement: HTMLElement) {
  const composer = within(canvasElement).getByLabelText('Session composer')
  const history = within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)
  expect(history.getBoundingClientRect().bottom).toBeCloseTo(
    composer.getBoundingClientRect().bottom,
    1,
  )
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
  const workspaceBounds = workspace.getBoundingClientRect()
  const fadeBounds = fade.getBoundingClientRect()
  expect(fadeBounds.top).toBeCloseTo(composerBounds.top + composerBounds.height / 2, 1)
  expect(fadeBounds.bottom).toBeCloseTo(workspaceBounds.bottom, 1)
  expect(fadeBounds.height).toBeCloseTo(composerBounds.height / 2, 1)
  expect(getComputedStyle(fade).pointerEvents).toBe('none')
}

async function expectJumpToLatestInComposerFade(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const history = await canvas.findByLabelText(SESSION_HISTORY_LABEL)
  await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(history.clientHeight))
  history.scrollTo({ top: 0 })
  fireEvent.scroll(history)
  const latest = await canvas.findByRole('button', { name: 'Jump to latest' })
  const composer = canvas.getByLabelText('Session composer')
  const latestBounds = latest.getBoundingClientRect()
  const composerBounds = composer.getBoundingClientRect()
  expect(latestBounds.left + latestBounds.width / 2).toBeCloseTo(
    composerBounds.left + composerBounds.width / 2,
    1,
  )
  expect(latestBounds.bottom).toBeLessThanOrEqual(composerBounds.top)
  latest.focus()
  await userEvent.keyboard('{Enter}')
  expect(history).toHaveFocus()
  await waitFor(() => expect(canvas.queryByRole('button', { name: 'Jump to latest' })).toBeNull())
}

function composerCard(canvasElement: HTMLElement) {
  const card = within(canvasElement)
    .getByLabelText('Session composer')
    .querySelector<HTMLElement>('[data-component="ComposerCard"]')
  if (card === null) throw new Error('The composer card is absent.')
  return card
}

// The composer's highest ink: the first stacked prompt above the card, or the card itself.
function composerInkTop(canvasElement: HTMLElement) {
  const prompts = within(canvasElement).queryAllByRole('region', { name: /^Permission needed/ })
  return Math.min(
    composerCard(canvasElement).getBoundingClientRect().top,
    ...prompts.map((prompt) => prompt.getBoundingClientRect().top),
  )
}

function feedEndGapAboveComposer(canvasElement: HTMLElement) {
  const history = within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)
  const rows = [...history.querySelectorAll<HTMLElement>('[data-feed-row]')]
  const lastRowBottom = Math.max(...rows.map((row) => row.getBoundingClientRect().bottom))
  return composerInkTop(canvasElement) - lastRowBottom
}

// `--spacing-snug`, the one gap the Feed keeps above the composer card.
const FEED_END_GAP_PX = 12

async function expectFeedEndsOneSnugAboveComposer(
  canvasElement: HTMLElement,
  { scrollToEnd }: { scrollToEnd: boolean },
) {
  const history = await within(canvasElement).findByLabelText(SESSION_HISTORY_LABEL)
  await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(history.clientHeight))
  await waitFor(() => {
    if (scrollToEnd) history.scrollTo({ top: history.scrollHeight })
    const gap = feedEndGapAboveComposer(canvasElement)
    expect(gap).toBeGreaterThanOrEqual(FEED_END_GAP_PX - 2)
    expect(gap).toBeLessThanOrEqual(FEED_END_GAP_PX + 2)
  })
}

// Each Allow control is on screen and takes a press, so no prompt is clipped away.
async function expectEveryAllowReachable(canvasElement: HTMLElement) {
  await waitFor(() => {
    for (const allow of within(canvasElement).getAllByRole('button', { name: 'Allow' })) {
      const bounds = allow.getBoundingClientRect()
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      )
      expect(hit !== null && allow.contains(hit)).toBe(true)
    }
  })
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
  expect(headerControls.contains(inspector)).toBe(true)
  const gap = Number.parseFloat(getComputedStyle(headerControls).getPropertyValue('gap'))
  expect(subagents.getBoundingClientRect().right).toBeLessThanOrEqual(
    shell.getBoundingClientRect().left - gap,
  )
  expect(shell.getBoundingClientRect().right).toBeLessThanOrEqual(
    inspector.getBoundingClientRect().left - gap,
  )
}

function expectSharedReadingColumn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const history = canvas.getByLabelText(SESSION_HISTORY_LABEL)
  const composer = canvas.getByLabelText('Session composer')
  const feedColumn = history.querySelector<HTMLElement>('.feed__content')
  const composerColumn = composer.querySelector<HTMLElement>('form')
  if (feedColumn === null || composerColumn === null)
    throw new Error('The shared reading column is absent.')
  const maximum = 48 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  expect(feedColumn.getBoundingClientRect().width).toBeLessThanOrEqual(maximum)
  expect(
    Math.abs(
      composerColumn.getBoundingClientRect().width - feedColumn.getBoundingClientRect().width,
    ),
  ).toBeLessThanOrEqual(2)
  expect(feedColumn.getBoundingClientRect().left).toBeCloseTo(
    history.getBoundingClientRect().left +
      (history.getBoundingClientRect().width - feedColumn.getBoundingClientRect().width) / 2,
    1,
  )
}

async function expectCollapsedSidebarDoesNotCoverSessionHeader(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
  const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
  const title = canvas.getByRole('heading', { name: 'Finish Session composer review' })
  await waitFor(() =>
    expect(title.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      opener.getBoundingClientRect().right +
        Number.parseFloat(getComputedStyle(title).getPropertyValue('--spacing-shell-tight')),
    ),
  )
  await userEvent.click(opener)
  await expect(canvas.getByLabelText('Sessions sidebar')).toBeVisible()
}

async function expectShellReopensWithOutput(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
  await userEvent.click(canvas.getByRole('button', { name: /^Shell/ }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /bun run quality/ }))
  const shellInspector = await canvas.findByRole('region', { name: 'Background Shell' })
  // The inspector stays invisible until its panel is ready, so the region mounts before it shows.
  await waitFor(() => expect(shellInspector).toBeVisible())
  await waitFor(
    () => expect(within(shellInspector).getByText(/Checked 187 files\./)).toBeVisible(),
    { timeout: 5000 },
  )
}

const meta = {
  title: 'Sessions/Screen',
  component: SessionScreenView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/projects/project-1/sessions']}>
        <div className="h-dvh w-full">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function pickSubagent(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: /^Subagents/ }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
  await waitFor(() =>
    expect(screen.queryByRole('menuitem', { name: /Interface review/ })).toBeNull(),
  )
}

async function expectDelegatedFeedSurvivesCollapse(canvas: ReturnType<typeof within>) {
  const inspector = canvas.getByRole('region', { name: 'Subagent' })
  await waitFor(
    () => {
      expect(inspector).toBeVisible()
      expect(inspector.getBoundingClientRect().width).toBeGreaterThan(0)
      const subagentMessage = within(inspector)
        .getAllByText(/Review finding \d+: The inspector keeps a complete implementation report/)
        .find((message) => message.getBoundingClientRect().height > 0)
      if (subagentMessage === undefined) throw new Error('The Subagent transcript is absent.')
      expect(subagentMessage).toBeVisible()
      expectVisibleFeedRowsDoNotOverlap(within(inspector).getByLabelText('Subagent history'))
    },
    { timeout: 5000 },
  )

  await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
  await waitFor(() => expect(inspector.querySelector('.feed__document')).toBeNull(), {
    timeout: 5000,
  })
  await pickSubagent(canvas)
  const reopenedInspector = await canvas.findByRole('region', { name: 'Subagent' })
  await waitFor(
    () =>
      expectVisibleFeedRowsDoNotOverlap(
        within(reopenedInspector).getByLabelText('Subagent history'),
      ),
    { timeout: 5000 },
  )
}

function expectNoSessionIdOrWorkspaceInHeader(canvasElement: HTMLElement) {
  const header = canvasElement.querySelector<HTMLElement>('[data-component="AppMainHeader"]')
  if (header === null) throw new Error('The Session header is absent.')
  const content = within(header)
  expect(content.queryByText('Session ID')).toBeNull()
  expect(content.queryByText('Workspace')).toBeNull()
}

export const Open: Story = {
  render: () => (
    <ReviewScreen
      workspaceId="workspace-feature"
      workspaces={[
        {
          id: 'workspace-feature',
          displayName: 'ticket-1846-composer',
          facts: { branch: 'feature/composer-review' },
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole('button', { name: /Finish Session composer review/ }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      canvas.getByRole('heading', { name: 'Finish Session composer review' }),
    ).toBeVisible()
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    await expect(canvas.getByText('Branch')).toBeVisible()
    await expect(canvas.getByText('feature/composer-review')).toBeVisible()
    await waitFor(() => expectHeaderActionsAtTrailingEdge(canvasElement), { timeout: 5000 })
    await expectCollapsedSidebarDoesNotCoverSessionHeader(canvasElement)
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    await waitFor(() => expectTranscriptRowsDoNotOverlap(canvasElement), { timeout: 5000 })

    const openInspector = canvas.queryByRole('button', { name: 'Open Session inspector' })
    if (openInspector) await userEvent.click(openInspector)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Collapse Session inspector' }),
      ).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await waitFor(() => expectSessionsSidebarIsOpen(canvasElement), { timeout: 5000 })

    // Picking a Subagent in the header opens the collapsed inspector on its transcript.
    await pickSubagent(canvas)
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Subagent' })).toBeInTheDocument(),
    )
    await expect(canvas.getByRole('button', { name: 'Collapse Session inspector' })).toBeVisible()

    await expectDelegatedFeedSurvivesCollapse(canvas)

    await expectShellReopensWithOutput(canvasElement)
  },
}

export const SwitchingKeepsScreenAreasOnTheSelectedSession: Story = {
  beforeEach: () => sessionSelectionHost(SESSION_ROSTER),
  render: () => <ProductionSessionSelectionScreen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: /^Shell/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /bun run quality/ }))
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Background Shell' })).toBeVisible(),
    )
    const firstComposer = canvas.getByRole('combobox', { name: 'Message' })
    await userEvent.type(firstComposer, 'Draft for the first Session')
    await expect(firstComposer).toHaveTextContent('Draft for the first Session')

    const nextSession = canvas.getByRole('button', { name: /Add Markdown typing shortcuts/ })
    await userEvent.click(nextSession)
    await expect(
      canvas.getByRole('button', { name: /Add Markdown typing shortcuts/ }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      canvas.getByRole('heading', { name: 'Add Markdown typing shortcuts' }),
    ).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'shortcut-review',
      ),
    )
    await expect(canvas.getByLabelText('Session composer')).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: 'Message' })).toHaveTextContent('')
    await expect(canvas.queryByRole('region', { name: 'Background Shell' })).toBeNull()
  },
}

// A Session switch retires the work pick and reopens nothing (comment in work-selection.ts).
// Returning to a Session whose picked Shell is still open must not read as a fresh pick either:
// the reader already dismissed that reveal by collapsing it, and switching away and back names no
// new one (#2852).
export const SwitchingBackDoesNotReopenADismissedInspector: Story = {
  beforeEach: () => sessionSelectionHost(SESSION_ROSTER),
  render: () => <ProductionSessionSelectionScreen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: /^Subagents/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Session inspector' })).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeVisible(),
    )

    await userEvent.click(canvas.getByRole('button', { name: /Add Markdown typing shortcuts/ }))
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'shortcut-review',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: /Finish Session composer review/ }))
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    await expect(
      canvas.getByRole('button', { name: 'Collapse Session inspector' }),
    ).not.toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeVisible()
  },
}

export const FormattedHeaderTitle: Story = {
  render: () => (
    <ReviewScreen titleText="[$implement](/skills/implement/SKILL.md) [https://example.com/guide](https://example.com/guide)" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('heading', { name: /Implement/ })
    await expect(header).not.toHaveTextContent('[$implement]')
    await expect(header).toHaveTextContent('https://example.com/guide')
    await expect(header.querySelector('a')).toBeNull()
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    expect(canvasElement.querySelector('[data-component="SessionMetadata"]')).toBeNull()
  },
}

export const CodexShellWithoutOutputDoesNotRevealInspector: Story = {
  render: () => (
    <ReviewScreen initialSessionId="shortcut-review" shellOutput={{ state: 'absent' }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Shell/ }))
    await userEvent.click(await screen.findByRole('menuitem'))
    await expect(canvas.queryByRole('region', { name: 'Background Shell' })).toBeNull()
    await expect(
      canvas.getByRole('button', { name: 'Collapse Session inspector' }),
    ).toBeInTheDocument()
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

export const NewSessionDoesNotStall: Story = {
  render: () => <NewSessionScreen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New Session' }))
    await expect(canvas.getByLabelText('Session composer')).toBeVisible()
    await new Promise((resolve) => window.setTimeout(resolve, 100))
    await expect(canvas.queryByText('Could not load this Session')).toBeNull()
  },
}

export const WideSharedReadingColumn: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  render: () => <ReviewScreen />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectSharedReadingColumn(canvasElement)
  },
}

export const JumpToLatestInExpandedComposerFade: Story = {
  render: () => <ReviewScreen rows={JUMP_TO_LATEST_ROWS} />,
  play: async ({ canvasElement }) => {
    await expectJumpToLatestInComposerFade(canvasElement)
  },
}

export const JumpToLatestInNormalComposerFade: Story = {
  render: () => <ReviewScreen initialSessionId="shortcut-review" rows={JUMP_TO_LATEST_ROWS} />,
  play: async ({ canvasElement }) => {
    await expectJumpToLatestInComposerFade(canvasElement)
  },
}

export const FeedEndsJustAboveComposer: Story = {
  render: () => <ReviewScreen initialSessionId="shortcut-review" rows={JUMP_TO_LATEST_ROWS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectFeedEndsOneSnugAboveComposer(canvasElement, { scrollToEnd: true })

    const card = composerCard(canvasElement)
    const oneLineHeight = card.getBoundingClientRect().height
    await userEvent.click(canvas.getByRole('combobox', { name: 'Message' }))
    // Paragraphs past the editor's maximum: the Feed stays at its end as the composer grows.
    for (const paragraph of ['First', 'Second', 'Third', 'Fourth', 'Fifth']) {
      await userEvent.keyboard(`${paragraph} paragraph{Shift>}{Enter}{/Shift}`)
    }
    await waitFor(() => expect(card.getBoundingClientRect().height).toBeGreaterThan(oneLineHeight))
    await expectFeedEndsOneSnugAboveComposer(canvasElement, { scrollToEnd: false })

    const history = canvas.getByLabelText(SESSION_HISTORY_LABEL)
    history.scrollTo({ top: 0 })
    fireEvent.scroll(history)
    await userEvent.click(await canvas.findByRole('button', { name: 'Jump to latest' }))
    await expectFeedEndsOneSnugAboveComposer(canvasElement, { scrollToEnd: false })
  },
}

// A pending permission request: the tray above the card is part of the composer's clearance.
export const FeedEndsAbovePermissionPrompt: Story = {
  render: () => (
    <ReviewScreen
      initialSessionId="shortcut-review"
      rows={JUMP_TO_LATEST_ROWS}
      permissionPrompt={
        <PermissionPrompt
          harness="claude"
          headingLevel={2}
          onDecide={async () => true}
          permission={{ id: 'pending', description: 'Bash {"command":"bun test"}' }}
        />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('region', { name: /^Permission needed/ }),
    ).toBeVisible()
    await expectEveryAllowReachable(canvasElement)
    await expectFeedEndsOneSnugAboveComposer(canvasElement, { scrollToEnd: true })
  },
}

export const FeedEndsAboveStackedPrompts: Story = {
  render: () => (
    <ReviewScreen
      initialSessionId="shortcut-review"
      rows={JUMP_TO_LATEST_ROWS}
      permissionPrompt={['bun test', 'bun run quality', 'git status'].map((command, index) => (
        <PermissionPrompt
          key={command}
          harness="claude"
          headingLevel={2}
          labels={{ allow: 'Allow', deny: 'Deny', title: `Permission needed: ${command}` }}
          onDecide={async () => true}
          permission={{
            id: `stacked-${index}`,
            description: `Bash {"command":"${command}"}`,
          }}
        />
      ))}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getAllByRole('heading', { name: /^Permission needed/ })).toHaveLength(3),
    )
    // The Feed opens at its end and stays there while the prompts enter and grow the composer.
    await expectFeedEndsOneSnugAboveComposer(canvasElement, { scrollToEnd: false })
    // Every stacked prompt and the context bar stay whole: the composer grows rather than clips.
    await expectEveryAllowReachable(canvasElement)
    const usage = canvas.getByText('Usage').getBoundingClientRect()
    expect(document.elementFromPoint(usage.left + 1, usage.top + usage.height / 2)).not.toBeNull()
    expect(usage.bottom).toBeLessThanOrEqual(
      canvas.getByLabelText('Session composer').getBoundingClientRect().bottom,
    )
  },
}

export const SharedCheckout: Story = {
  render: () => <ReviewScreen initialSessionId="shortcut-review" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Add Markdown typing shortcuts' }),
    ).toBeVisible()
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    expect(canvas.queryByText('Branch')).not.toBeInTheDocument()
  },
}

export const NarrowHeader: Story = {
  render: () => (
    <div className="h-dvh w-[calc(var(--size-navigation-rail)+var(--size-cockpit-sidebar-min)+var(--size-cockpit-content-min))]">
      <ReviewScreen
        workspaceId="workspace-feature"
        workspaces={[
          {
            id: 'workspace-feature',
            displayName: 'ticket-1846-composer',
            facts: { branch: 'feature/composer-review' },
          },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Finish Session composer review' }),
    ).toBeVisible()
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    await expect(canvas.getByText('feature/composer-review')).toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectFeedDoesNotOverlapComposer(canvasElement)
    expectHeaderActionsAtTrailingEdge(canvasElement)
  },
}

export const WorkspaceMainBranch: Story = {
  render: () => (
    <ReviewScreen
      workspaceId="workspace-main"
      workspaces={[{ id: 'workspace-main', displayName: 'Argo', facts: { branch: 'main' } }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    await expect(canvas.getByText('Branch')).toBeVisible()
    await expect(canvas.getByText('main')).toBeVisible()
  },
}

export const WorkspaceDetachedHead: Story = {
  render: () => (
    <ReviewScreen
      workspaceId="workspace-detached"
      workspaces={[
        { id: 'workspace-detached', displayName: 'Detached checkout', facts: { branch: null } },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    expect(canvas.queryByText('Branch')).not.toBeInTheDocument()
  },
}

export const LegacySessionWithoutWorkspace: Story = {
  render: () => (
    <ReviewScreen
      workspaces={[{ id: 'workspace-main', displayName: 'Argo', facts: { branch: 'main' } }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    expect(canvas.queryByText('Branch')).not.toBeInTheDocument()
  },
}

export const RemovedWorkspace: Story = {
  render: () => (
    <ReviewScreen
      workspaceId="workspace-removed"
      workspaces={[{ id: 'workspace-main', displayName: 'Argo', facts: { branch: 'main' } }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    expect(canvas.queryByText('Branch')).not.toBeInTheDocument()
  },
}

export const LongWorkspaceAndBranchNames: Story = {
  render: () => (
    <div className="h-dvh w-[calc(var(--size-navigation-rail)+var(--size-cockpit-sidebar-min)+var(--size-cockpit-content-min))]">
      <ReviewScreen
        workspaceId="workspace-long"
        workspaces={[
          {
            id: 'workspace-long',
            displayName: 'A workspace name that is much longer than the header can display',
            facts: {
              branch:
                'feature/a-branch-name-that-is-much-longer-than-the-header-can-display-or-the-session-title',
            },
          },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const viewport = canvasElement.getBoundingClientRect()
    expectNoSessionIdOrWorkspaceInHeader(canvasElement)
    await expect(
      canvas.getByText(
        'feature/a-branch-name-that-is-much-longer-than-the-header-can-display-or-the-session-title',
      ),
    ).toBeVisible()
    for (const control of [
      canvas.getByRole('button', { name: /^Subagents/ }),
      canvas.getByRole('button', { name: /^Shell/ }),
      canvas.getByRole('button', { name: 'Open Session inspector' }),
    ]) {
      await expect(control).toBeVisible()
      const bounds = control.getBoundingClientRect()
      expect(bounds.left).toBeGreaterThanOrEqual(viewport.left)
      expect(bounds.right).toBeLessThanOrEqual(viewport.right)
    }
  },
}
