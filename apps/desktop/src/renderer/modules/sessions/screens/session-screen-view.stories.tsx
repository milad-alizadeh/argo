import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, screen, userEvent, waitFor, within } from 'storybook/test'
import type { SessionDelegation, SessionShellCommand } from '@/core/sessions/models'
import { CockpitShell } from '../../cockpit/components/cockpit-shell'
import { SessionComposer } from '../components/composer/session-composer'
import { SessionInspector } from '../components/inspector/session-inspector'
import { SessionsSidebarContent } from '../components/roster/sessions-sidebar'
import { SessionWorkButtons } from '../components/work/session-work-buttons'
import { SessionWorkInspectorHeader } from '../components/work/session-work-inspector-header'
import { RICH_MARKDOWN } from '../feed/content/feed-samples'
import { sessionDelegation, sessionRosterRow, sessionShellCommand } from '../session-fixtures'
import type { Session, SessionFeed } from '../types'
import { SessionScreenView } from './session-screen-view'
import { SessionShell } from './session-shell'

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
    activity: { label: 'Ran bun run quality', tool: 'Bash', target: 'bun run quality' },
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
    activity: { label: 'Read feed-document.tsx', tool: 'Read', target: 'feed-document.tsx' },
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
    return <SessionWorkInspectorHeader work={{ kind: 'delegation', delegation, tokens: null }} />
  }
  return null
}

function ReviewScreen({
  initialSessionId = 'composer-review',
  rows = null,
  showPlan = true,
}: {
  initialSessionId?: string
  rows?: SessionFeed['rows'] | null
  showPlan?: boolean
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId)
  // The header's picks drive a real inspector, so the story shows what picking a row opens.
  const [picked, setPicked] = useState<{ id: string; count: number } | null>(null)
  const pick = (id: string) => setPicked((last) => ({ id, count: (last?.count ?? 0) + 1 }))
  const session = SESSION_ROSTER.find(({ id }) => id === selectedSessionId)
  const feed = rows === null ? feedFor(selectedSessionId) : { ...feedFor(selectedSessionId), rows }
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
            plan={showPlan ? session.plan : null}
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

function NewSessionScreen() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  return (
    <CockpitShell
      sidebar={
        <SessionsSidebarContent
          onNew={() => setSelectedSessionId('optimistic:new-session')}
          onSelect={setSelectedSessionId}
          roster={{
            sessions: [],
            filesFound: 0,
            filesRead: 0,
            filesUnreadable: 0,
          }}
          rosterError={null}
          selectedSessionId={selectedSessionId}
        />
      }
    >
      <SessionShell
        activeEvidenceId={null}
        answeringQuestionId={null}
        composer={
          selectedSessionId === null ? null : (
            <SessionComposer onSend={async () => true} sessionId={selectedSessionId} />
          )
        }
        feed={null}
        feedError={null}
        inspector={null}
        isRunning={false}
        onAnswerQuestion={() => {}}
        onOpenEvidence={() => {}}
        onOpenSession={() => {}}
        onRetryFeed={() => {}}
        questionFailure={() => null}
        selectedSessionId={selectedSessionId}
        stallTimeoutMs={50}
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

  expect(history.scrollHeight).toBeGreaterThan(history.clientHeight)
  expect(history.scrollTop).toBeGreaterThan(0)
  expect(history.getBoundingClientRect().bottom).toBeGreaterThan(before.top)
  history.scrollTo({ top: 0 })
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

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
  const workspaceBounds = workspace.getBoundingClientRect()
  const fadeBounds = fade.getBoundingClientRect()
  expect(fadeBounds.top).toBeCloseTo(composerBounds.top, 1)
  expect(fadeBounds.bottom).toBeCloseTo(workspaceBounds.bottom, 1)
  expect(fadeBounds.height).toBeCloseTo(composerBounds.height, 1)
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
  await userEvent.click(latest)
  await waitFor(() => expect(canvas.queryByRole('button', { name: 'Jump to latest' })).toBeNull())
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
  expect(title.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    opener.getBoundingClientRect().right +
      Number.parseFloat(getComputedStyle(title).getPropertyValue('--spacing-shell-tight')),
  )
  await userEvent.click(opener)
  await expect(canvas.getByLabelText('Sessions sidebar')).toBeVisible()
}

async function expectShellReopensWithOutput(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
  await userEvent.click(canvas.getByRole('button', { name: /^Shell/ }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /bun run quality/ }))
  const shellInspector = canvas.getByRole('region', { name: 'Background Shell' })
  await expect(shellInspector).toBeVisible()
  await expect(within(shellInspector).getByText(/Checked 187 files\./)).toBeVisible()
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

async function pickSubagent(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: /^Subagents/ }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
  await waitFor(() =>
    expect(screen.queryByRole('menuitem', { name: /Interface review/ })).toBeNull(),
  )
}

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
    await pickSubagent(canvas)
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Subagent' })).toBeInTheDocument(),
    )
    const inspector = canvas.getByRole('region', { name: 'Subagent' })
    await expect(inspector).toBeVisible()
    expect(inspector.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(canvas.getByRole('button', { name: 'Collapse Session inspector' })).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeVisible(),
    )
    await pickSubagent(canvas)
    const reopenedInspector = await canvas.findByRole('region', { name: 'Subagent' })
    await expect(reopenedInspector).toBeVisible()
    expect(reopenedInspector.getBoundingClientRect().width).toBeGreaterThan(0)
    const subagentMessage = within(reopenedInspector)
      .getAllByText('Use the approved prototype to review the Session composer in context.')
      .find((message) => message.getBoundingClientRect().height > 0)
    if (subagentMessage === undefined) throw new Error('The Subagent transcript is absent.')
    await expect(subagentMessage).toBeVisible()

    await expectShellReopensWithOutput(canvasElement)
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

export const ComposerFadeLight: Story = {
  globals: { theme: 'light' },
  render: () => <ReviewScreen />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectContextBarInset(canvasElement)
  },
}

export const ComposerFadeDark: Story = {
  globals: { theme: 'dark' },
  render: () => <ReviewScreen />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText(SESSION_HISTORY_LABEL)).toHaveAttribute(
        'data-session',
        'composer-review',
      ),
    )
    expectContextBarInset(canvasElement)
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
