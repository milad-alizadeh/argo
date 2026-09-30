import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { sessionRow, sessionSubagent } from '@/mocks/sessions/session-rows'
import {
  type FeedRead,
  sessionFeedRefreshTrpc,
  sessionFeedSubscribe,
  storySessionPage,
} from '@/mocks/sessions/session-story-host'
import {
  queryClient,
  type RouterInputs,
  type RouterOutputs,
  trpcClient,
} from '@/platform/renderer/trpc-client'
import { replaceComposerCommands } from '../../composer/references/composer-command-registry'
import { useFeedReading } from '../../feed/use-feed-reading'
import type { Session, SessionError, SessionId, SessionListResult } from '../../types'
import { SessionList, type SessionListActions } from '../session-list'
import { sessionListPathKey } from '../session-list-query'
import { useArchiveSelected } from './use-session-archive-mutation'

const session = sessionRow({
  id: 'prose',
  posture: 'external',
  customTitle: 'Read the Session transcript',
  preview: 'A transcript preview',
  title: { text: 'Read the Session transcript', source: 'first-prompt' },
  status: 'idle',
  cwd: '/workspace/argo',
  subagents: [sessionSubagent({ id: 'interface-review', label: 'Interface review' })],
})

const secondSession: Session = {
  ...session,
  id: 'second-session',
  customTitle: null,
  preview: 'A second Session',
  title: { text: 'A second Session', source: 'summarised' },
}

const listed: Session[] = [session, secondSession]

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-session-list-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

type SessionSyncStatus = Extract<RouterOutputs['sessionSyncStatus'], { type: 'status' }>['status']
type SessionSyncEvent = RouterOutputs['sessionSyncStatus']

const initialSyncStatus: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}

type SessionListRead = Required<RouterInputs['sessionList']>
type SessionListHandler = (read: SessionListRead) => Promise<SessionListResult | SessionError>
type SessionUpdateHandler = (update: RouterInputs['sessionUpdate']) => Promise<Session[]>
type Listener = Parameters<typeof window.argo.trpcSubscribe>[1]

// Every Session List read and Session update a story's host answered, in order.
let sessionListReads = fn<SessionListHandler>()
let sessionUpdates = fn<SessionUpdateHandler>()
let publishSessionSyncEvent = (_event: SessionSyncEvent) => {}
let announceSessionListChange = (_sessionIds: readonly SessionId[]) => {}

// One offset page of these rows, as main's list query cuts it.
function listPage(sessions: readonly Session[], read: SessionListRead): SessionListResult {
  return { total: sessions.length, rows: sessions.slice(read.offset, read.offset + read.limit) }
}

function missingUpdate(): Promise<Session[]> {
  return Promise.reject(new Error('This story answers no Session update.'))
}

// Answers the `sessionList` query and `sessionUpdate` through tRPC, and sends changed rows on the
// `sessionListChanged` subscription when a story announces them.
function withSessionListHost(
  handler: SessionListHandler,
  update: SessionUpdateHandler = missingUpdate,
) {
  queryClient.removeQueries({ queryKey: sessionListPathKey })
  sessionListReads = fn(handler)
  sessionUpdates = fn(update)
  const before = window.argo
  const syncListeners = new Map<number, Listener>()
  const changeListeners = new Map<number, Listener>()
  let syncStatus = initialSyncStatus
  publishSessionSyncEvent = (event) => {
    if (event.type === 'status') syncStatus = event.status
    for (const [id, listener] of syncListeners)
      listener({ id, type: 'data', result: { data: event } })
  }
  announceSessionListChange = (sessionIds) => {
    for (const [id, listener] of changeListeners)
      listener({ id, type: 'data', result: { data: { sessionIds: [...sessionIds] } } })
  }
  window.argo = {
    ...before,
    trpc: (async (request) => {
      if (request.path === 'sessionUpdate') {
        const updated = await sessionUpdates(request.input as RouterInputs['sessionUpdate'])
        return { id: request.id, result: { data: updated } }
      }
      if (request.path !== 'sessionList') return before.trpc(request)
      const reply = await sessionListReads(request.input as SessionListRead)
      if ('type' in reply) return { id: request.id, error: { message: reply.message } }
      return { id: request.id, result: { data: reply } }
    }) as typeof window.argo.trpc,
    trpcSubscribe: async (request, listener) => {
      if (request.path === 'sessionListChanged') {
        changeListeners.set(request.id, listener)
        return () => changeListeners.delete(request.id)
      }
      if (request.path !== 'sessionSyncStatus') return before.trpcSubscribe(request, listener)
      syncListeners.set(request.id, listener)
      listener({
        id: request.id,
        type: 'data',
        result: { data: { type: 'status', status: syncStatus } },
      })
      return () => syncListeners.delete(request.id)
    },
  }
  return () => {
    publishSessionSyncEvent = () => {}
    announceSessionListChange = () => {}
    window.argo = before
  }
}

function showingSessions(sessions: readonly Session[]) {
  return withSessionListHost(async (read) => storySessionPage(sessions, read))
}

function publishSyncStatus(status: SessionSyncStatus) {
  publishSessionSyncEvent({ type: 'status', status })
}

// Rows that change after the first read: main stores each change, then announces the changed rows.
function withSessionsHost(initialSessions: readonly Session[]) {
  let sessions = [...initialSessions]
  const store = (changed: readonly Session[]) => {
    const fresh = changed.filter((row) => !sessions.some(({ id }) => id === row.id))
    sessions = [...sessions.map((row) => changed.find(({ id }) => id === row.id) ?? row), ...fresh]
  }
  const restore = withSessionListHost(
    async (read) => storySessionPage(sessions, read),
    async ({ sessionIds, title, archived }) => {
      const updated = sessions
        .filter(({ id }) => sessionIds.includes(id))
        .map((current) => ({
          ...current,
          customTitle: title ?? current.customTitle,
          title: title === undefined ? current.title : { text: title, source: 'custom' as const },
          archived: archived ?? current.archived,
        }))
      store(updated)
      announceSessionListChange(updated.map(({ id }) => id))
      return updated
    },
  )
  return {
    announce(changed: readonly Session[]) {
      store(changed)
      announceSessionListChange(changed.map(({ id }) => id))
    },
    restore,
  }
}

// The rename the sidebar sends: one Session update, which the host stores and announces.
async function renameThroughSessionUpdate(renamed: Session, name: string) {
  await trpcClient.sessionUpdate.mutate({ sessionIds: [renamed.id], title: name })
}

type SessionListHarnessArgs = SessionListActions & { selectedSessionId: SessionId | null }

// The presentational seam Storybook drives: SessionList's own props, plus the routing a real caller
// gives it. Project scoping plays no part in what a story renders, so every story reads the same
// null root and tells the Session list apart by what `sessionList` answers instead.
function SessionListHarness({ selectedSessionId, ...actions }: SessionListHarnessArgs) {
  return (
    <SessionList actions={actions} projectId="project-1" selectedSessionId={selectedSessionId} />
  )
}

function SelectableSessionList(args: SessionListHarnessArgs) {
  const [selectedSessionId, setSelectedSessionId] = useState(args.selectedSessionId)
  useFeedReading(selectedSessionId)
  return (
    <SessionListHarness
      {...args}
      onSelect={(sessionId) => {
        setSelectedSessionId(sessionId)
        args.onSelect(sessionId)
      }}
      selectedSessionId={selectedSessionId}
    />
  )
}

function RoutedSessionList(args: SessionListHarnessArgs) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedSessionId = location.pathname.split('/').at(-1) ?? null
  return (
    <>
      <SessionListHarness
        {...args}
        onSelect={(sessionId) => {
          navigate(`/sessions/${sessionId}`)
          args.onSelect(sessionId)
        }}
        selectedSessionId={location.pathname === '/sessions' ? null : selectedSessionId}
      />
      <output aria-label="Session route">{location.pathname}</output>
    </>
  )
}

const meta = {
  title: 'Sessions/SessionList',
  component: SessionListHarness,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/sessions']}>
        <div className="h-dvh w-80">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  // Each story installs a fresh Session-list host and query result.
  beforeEach: () => showingSessions(listed),
  args: {
    onArchiveSelected: fn(),
    onNew: fn(),
    onOpenTicket: fn(),
    onRename: fn(renameThroughSessionUpdate),
    onSelect: fn(),
    selectedSessionId: null,
  },
} satisfies Meta<typeof SessionListHarness>

export default meta
type Story = StoryObj<typeof SessionListHarness>

let recoverMissingHistory = () => {}

export const UnavailableHistoryRecovers: Story = {
  args: { selectedSessionId: session.id },
  render: (args) => <SelectableSessionList {...args} />,
  beforeEach: () => {
    const before = window.argo
    let historyAvailable = false
    recoverMissingHistory = () => {
      historyAvailable = true
    }
    const read: FeedRead = async (sessionId) => {
      if (!historyAvailable && sessionId === session.id) {
        throw Object.assign(new Error(readFailure.message), { data: { code: 'NOT_FOUND' } })
      }
      return []
    }
    window.argo = {
      ...before,
      trpcSubscribe: sessionFeedSubscribe(before.trpcSubscribe, read),
      trpc: sessionFeedRefreshTrpc(before.trpc),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', {
      name: /Read the Session transcript/,
    })
    await waitFor(() => expect(row).toHaveAttribute('data-history-unavailable', 'true'), {
      timeout: 5000,
    })
    await expect(row).toHaveTextContent('Unavailable')
    await userEvent.click(within(canvasElement).getByRole('button', { name: /A second Session/ }))
    await expect(row).toHaveAttribute('data-history-unavailable', 'true')
    recoverMissingHistory()
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('data-history-unavailable', 'false'))
    await expect(row).not.toHaveTextContent('Unavailable')
  },
}

function expectNewSessionIconAligned(canvas: ReturnType<typeof within>, row: HTMLElement) {
  const newSessionIcon = canvas.getByRole('button', { name: 'New Session' }).querySelector('svg')
  if (newSessionIcon === null) throw new Error('The New Session icon is absent.')
  expect(newSessionIcon.getBoundingClientRect().right).toBeCloseTo(
    row.getBoundingClientRect().right,
    1,
  )
}

// The searched list holds the second Session and not the first; an in-flight read shows neither.
function expectOnlySecondSession(canvas: ReturnType<typeof within>, first: RegExp) {
  expect(canvas.getByRole('button', { name: /A second Session/ })).toBeVisible()
  expect(canvas.queryByRole('button', { name: first })).toBeNull()
}

export const Discovered: Story = {
  render: (args) => <RoutedSessionList {...args} />,
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed)
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
    await expect(search).toHaveAttribute('placeholder', 'Search Sessions…')
    await expect(canvas.getByRole('button', { name: 'New Session' })).toBeEnabled()
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(row).toHaveAccessibleName(/Idle/)
    await expect(row.querySelector('svg')).not.toBeNull()
    await userEvent.click(row)
    await expect(args.onSelect).toHaveBeenCalledWith('prose')
    await expect(row).toHaveAttribute('aria-current', 'page')
    await expect(row).toHaveFocus()
    expect(getComputedStyle(row).outlineColor).toBe('rgba(0, 0, 0, 0)')
    expectNewSessionIconAligned(canvas, row)
    await userEvent.keyboard('{ArrowDown}')
    const second = canvas.getByRole('button', { name: /A second Session/ })
    await expect(second).toHaveFocus()
    expect(second.matches(':focus-visible')).toBe(true)
    await userEvent.keyboard('{Enter}')
    await expect(second).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      '/sessions/second-session',
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    const rename = await within(document.body).findByRole('menuitem', { name: 'Rename' })
    await userEvent.click(rename)
    const dialog = within(document.body).getByRole('dialog', { name: 'Rename Session' })
    const input = within(dialog).getByRole('textbox', { name: 'Name' })
    await expect(input).toHaveValue('Read the Session transcript')
    await userEvent.clear(input)
    await userEvent.type(input, '  Keep the Session list stable\n')
    await userEvent.keyboard('{Enter}')
    await expect(
      await canvas.findByRole('button', { name: /Keep the Session list stable/ }),
    ).toBeInTheDocument()
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      '/sessions/second-session',
    )
    await expect(
      canvas.getAllByRole('button').filter((button) => button.dataset.sessionId),
    ).toHaveLength(2)
    await userEvent.click(search)
    await userEvent.keyboard('second')
    await waitFor(() => expectOnlySecondSession(canvas, /Keep the Session list stable/))
  },
}

export const CommandTitledSession: Story = {
  beforeEach: () => {
    replaceComposerCommands('claude', [
      {
        name: 'implement',
        description: 'Build an approved ticket',
        argumentHint: '',
        aliases: [],
      },
    ])
    const restore = showingSessions([
      { ...session, title: { text: '/implement 1847', source: 'first-prompt' } },
    ])
    return () => {
      replaceComposerCommands('claude', [])
      restore()
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reference = await canvas.findByText('/implement')
    await expect(reference.closest('span.inline-flex')?.querySelector('svg')).not.toBeNull()
    await expect(canvas.getByRole('button', { name: /\/implement 1847/ })).toBeVisible()
  },
}

export const ActiveSessionSpinsItsHarnessLogo: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        status: 'running',
        title: { text: 'Build the approved sessionList layout', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Build the approved sessionList layout/ })
    await expect(row).toHaveAccessibleName(/Running/)
    await expect(row.querySelector('[data-slot="loader"]')).toBeNull()
    await expect(row.querySelector('[data-slot="harness-logo"]')).toHaveAttribute(
      'data-active',
      'true',
    )
    await expect(row.querySelector('[data-slot="session-status"]')).toHaveAttribute(
      'data-variant',
      'active',
    )
  },
}

// Optional activity metadata must not present `unknown` status as an activity summary.
export const MissingActivityKeepsStatusOutOfTheSubtitle: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        activity: null,
        status: 'unknown',
        title: { text: 'A Session with no observed activity', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const unknown = await canvas.findAllByText('Unknown')
    await expect(unknown).toHaveLength(1)
    await expect(unknown[0]).toHaveClass('sr-only')
    await expect(canvas.queryByText('unknown')).toBeNull()
  },
}

// A command still open in a running Session reads "Running", the Feed's own verb; the same call
// reads "Ran" once the Session settles, whatever the transcript last said about it.
export const OpenCommandReadsRunning: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        id: 'running-command',
        activity: {
          label: 'Ran bun run quality',
          kind: 'command',
          open: true,
          tool: 'Bash',
          target: 'bun run quality',
        },
        status: 'running',
        title: { text: 'Gate the branch', source: 'first-prompt' },
      },
      {
        ...session,
        id: 'settled-command',
        activity: {
          label: 'Ran bun run quality',
          kind: 'command',
          open: true,
          tool: 'Bash',
          target: 'bun run quality',
        },
        status: 'idle',
        title: { text: 'Gated the branch', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Running bun run quality')).toBeVisible()
    await expect(canvas.getByText('Ran bun run quality')).toBeVisible()
  },
}

function concurrentActivityRows(activityBySession: Record<string, string>) {
  return ['Alpha', 'Beta', 'Gamma'].map((name) => ({
    ...session,
    id: name.toLowerCase(),
    title: { text: `${name} session`, source: 'first-prompt' as const },
    status: activityBySession[name] === undefined ? ('idle' as const) : ('running' as const),
    cwd: null,
    subagents: [],
    activity:
      activityBySession[name] === undefined
        ? null
        : {
            label: activityBySession[name],
            kind: 'command' as const,
            open: true,
            tool: 'command',
            target: null,
          },
  }))
}

export const ConcurrentActivityKeepsRowsStill: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost(concurrentActivityRows({}))
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const alpha = await canvas.findByRole('button', { name: /Alpha session/ })
    const beta = canvas.getByRole('button', { name: /Beta session/ })
    const gamma = canvas.getByRole('button', { name: /Gamma session/ })
    const buttons = [alpha, beta, gamma]
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const originalTop = buttons.map((row) => row.getBoundingClientRect().top)
    const activities: Record<string, string> = {}
    const measurements: { session: string; paintMs: number; frameMs: number; tops: number[] }[] = []
    async function publishActivity(name: string) {
      activities[name] = `Ran ${name.toLowerCase()} command`
      const row = concurrentActivityRows(activities).find(
        (candidate) => candidate.id === name.toLowerCase(),
      )
      if (row === undefined) throw new Error(`Missing ${name} Session row`)
      const started = performance.now()
      sessionsHost?.announce([row])
      await expect(await canvas.findByText(`Running ${name.toLowerCase()} command`)).toBeVisible()
      const firstFrame = await new Promise<number>((resolve) => requestAnimationFrame(resolve))
      const secondFrame = await new Promise<number>((resolve) => requestAnimationFrame(resolve))
      const tops = buttons.map((button) => button.getBoundingClientRect().top)
      measurements.push({
        session: name,
        paintMs: secondFrame - started,
        frameMs: secondFrame - firstFrame,
        tops,
      })
      canvasElement.dataset.activityReplay = JSON.stringify(measurements)
      expect(tops).toEqual(originalTop)
    }

    await publishActivity('Alpha')
    expect(beta).not.toHaveTextContent('Running alpha command')
    expect(gamma).not.toHaveTextContent('Running alpha command')
    await publishActivity('Beta')
    await publishActivity('Gamma')
    expect(alpha).toHaveTextContent('Running alpha command')
    expect(beta).toHaveTextContent('Running beta command')
    expect(gamma).toHaveTextContent('Running gamma command')
    expect(alpha).not.toHaveTextContent('Running beta command')
    expect(beta).not.toHaveTextContent('Running gamma command')
    expect(canvas.getByRole('button', { name: /Alpha session/ })).toBe(alpha)
    expect(canvas.getByRole('button', { name: /Beta session/ })).toBe(beta)
    expect(canvas.getByRole('button', { name: /Gamma session/ })).toBe(gamma)
    expect(Math.max(...measurements.map((sample) => sample.paintMs))).toBeLessThan(500)
    expect(Math.max(...measurements.map((sample) => sample.frameMs))).toBeLessThan(100)
  },
}

// The agent's commentary draws its Markdown; a command's label stays literal.
export const CommentaryActivityDrawsMarkdown: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        id: 'commentary',
        activity: {
          label: '**Checking** the `tool-groups.ts` order',
          kind: 'thought',
          open: true,
          tool: 'thought',
          target: null,
        },
        status: 'running',
        title: { text: 'Order the group phrases', source: 'first-prompt' },
      },
      {
        ...session,
        id: 'literal-command',
        activity: {
          label: 'Ran ls *.ts *.tsx',
          kind: 'command',
          open: false,
          tool: 'Bash',
          target: 'ls *.ts *.tsx',
        },
        status: 'idle',
        title: { text: 'List the sources', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Checking')).toBeVisible()
    await expect(canvas.getByText('tool-groups.ts').tagName).toBe('CODE')
    await expect(canvas.queryByText(/\*\*Checking\*\*/)).toBeNull()
    await expect(canvas.getByText('Ran ls *.ts *.tsx')).toBeVisible()
  },
}

export const SessionListStructure: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        activity: {
          label: 'Watch PR checks',
          kind: 'command',
          open: false,
          tool: 'Bash',
          target: 'RTK_DISABLED=1 gh pr checks 2062 --watch',
        },
        status: 'running',
        plan: {
          state: 'available',
          entries: [
            { content: 'Inspect the sessionList', position: 0, status: 'completed' },
            { content: 'Match the layout', position: 1, status: 'in_progress' },
          ],
        },
        title: { text: 'Codex session names displaying as ID', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Watch PR checks')).toBeVisible()
    await expect(canvas.queryByText(/Bash RTK_DISABLED=1 gh pr checks 2062/)).toBeNull()
    await expect(canvas.getByLabelText('1 of 2 steps completed')).toBeVisible()
  },
}

// The dot beside a blocked Session is already `bg-warn` for both statuses; the badge names the
// shared action the reader must take (#2509).
export const PendingBadges: Story = {
  beforeEach: () =>
    showingSessions([
      session,
      {
        ...session,
        id: 'wants-answer',
        posture: 'live',
        status: 'asking',
        title: { text: 'A question is waiting', source: 'first-prompt' },
      },
      {
        ...session,
        id: 'wants-permission',
        status: 'permission',
        title: { text: 'A tool call is waiting', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const wantsAnswer = await canvas.findByRole('button', { name: /A question is waiting/ })
    await expect(within(wantsAnswer).getByText('Needs input')).toBeVisible()
    await expect(wantsAnswer.querySelector('[data-slot="session-status"]')).toHaveAttribute(
      'data-variant',
      'attention',
    )
    const wantsPermission = canvas.getByRole('button', { name: /A tool call is waiting/ })
    await expect(within(wantsPermission).getByText('Needs input')).toBeVisible()
    const idle = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await expect(within(idle).queryByText('Needs input')).toBeNull()
  },
}

export const StatusTransitions: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost([
      {
        ...session,
        id: 'waiting-for-permission',
        status: 'permission',
        title: { text: 'Approve the command', source: 'first-prompt' },
      },
      {
        ...session,
        id: 'idle-session',
        title: { text: 'Read the idle Session', source: 'first-prompt' },
      },
      {
        ...session,
        id: 'starting-session',
        status: 'starting',
        title: { text: 'New Session', source: 'first-prompt' },
      },
    ])
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const waiting = await canvas.findByRole('button', { name: /Approve the command/ })
    const idle = canvas.getByRole('button', { name: /Read the idle Session/ })
    const starting = canvas
      .getAllByRole('button')
      .find((button) => button.dataset.sessionId === 'starting-session')
    if (starting === undefined) throw new Error('The starting Session row is absent.')
    await expect(waiting.querySelector('[data-slot="session-status"]')).toHaveAttribute(
      'data-variant',
      'attention',
    )
    await expect(idle.querySelector('[data-slot="session-status"]')).toHaveAttribute(
      'data-variant',
      'idle',
    )
    await expect(starting.querySelector('[data-slot="session-status"]')).toHaveAttribute(
      'data-variant',
      'idle',
    )
    await expect(starting.querySelector('[data-slot="harness-logo"]')).toHaveAttribute(
      'data-active',
      'false',
    )
    sessionsHost?.announce([
      { ...session, id: 'waiting-for-permission', status: 'idle' },
      {
        ...session,
        id: 'idle-session',
        status: 'running',
        title: { text: 'Read the idle Session', source: 'first-prompt' },
      },
    ])
    await waitFor(async () => {
      await expect(waiting.querySelector('[data-slot="session-status"]')).toHaveAttribute(
        'data-variant',
        'idle',
      )
      await expect(idle.querySelector('[data-slot="session-status"]')).toHaveAttribute(
        'data-variant',
        'active',
      )
    })
  },
}

export const NeedsInputClearsAfterResolution: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost([
      {
        ...session,
        id: 'waiting-for-permission',
        status: 'permission',
        title: { text: 'Approve the command', source: 'first-prompt' },
      },
    ])
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const waiting = await canvas.findByRole('button', { name: /Approve the command/ })
    await expect(within(waiting).getByText('Needs input')).toBeVisible()
    sessionsHost?.announce([{ ...session, id: 'waiting-for-permission', status: 'idle' }])
    await waitFor(() => expect(within(waiting).queryByText('Needs input')).toBeNull())
  },
}

export const NarrowSidebarWithLongSessionName: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        title: {
          text: 'Keep the Sessions sidebar readable when a Session name is substantially longer than its pane',
          source: 'first-prompt',
        },
      },
    ]),
  decorators: [
    (Story) => (
      <div className="h-dvh w-44">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByLabelText('Sessions sidebar')
    const name = await within(sidebar).findByText(/Keep the Sessions sidebar readable/)
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(sidebar.scrollWidth).toBeLessThanOrEqual(sidebar.clientWidth)
  },
}

export const RefreshProgressWhileFetching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    publishSyncStatus({ ...initialSyncStatus, phase: 'fetching' })
    const progress = await canvas.findByRole('progressbar', { name: 'Session refresh progress' })
    await expect(canvas.getAllByRole('progressbar')).toHaveLength(1)
    await expect(progress).not.toHaveAttribute('aria-valuenow')
    await expect(canvas.getByRole('status')).toHaveTextContent('Syncing Sessions…')
    const filter = canvas.getByRole('button', { name: 'Filter Sessions' })
    await userEvent.click(filter)
    await waitFor(() => expect(filter).toHaveAttribute('aria-expanded', 'true'))
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Refresh Sessions' }),
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const RefreshProgressWhileSaving: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    publishSyncStatus({ ...initialSyncStatus, phase: 'saving', processed: 1, total: 2 })
    const progress = await canvas.findByRole('progressbar', { name: 'Session refresh progress' })
    await expect(progress).toHaveAttribute('aria-valuenow', '50')
    await expect(canvas.getByRole('status')).toHaveTextContent('Syncing 1 out of 2 Sessions')
    const filter = canvas.getByRole('button', { name: 'Filter Sessions' })
    await userEvent.click(filter)
    await waitFor(() => expect(filter).toHaveAttribute('aria-expanded', 'true'))
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Refresh Sessions' }),
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const PartialRefreshShowsOneToast: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    publishSyncStatus({ ...initialSyncStatus, phase: 'ready', skipped: 2 })
    const toast = await within(document.body).findByText(
      'Skipped 2 Sessions with unreadable metadata.',
    )
    await expect(toast).toBeVisible()
    await expect(
      within(document.body).getAllByText('Skipped 2 Sessions with unreadable metadata.'),
    ).toHaveLength(1)
    await expect(canvas.queryByRole('progressbar')).toBeNull()
  },
}

export const FailedRefreshShowsOneToast: Story = {
  play: async ({ canvasElement }) => {
    publishSyncStatus({ ...initialSyncStatus, phase: 'failed', failure: 'Reader unavailable.' })
    await waitFor(() => {
      const toastTitles = document.body.querySelectorAll('[data-slot="toast-title"]')
      expect(toastTitles).toHaveLength(1)
      expect(toastTitles[0]).toHaveTextContent('Could not sync Sessions.')
    })
    await expect(within(document.body).getByText('Reader unavailable.')).toBeVisible()
    await expect(within(canvasElement).queryByRole('status')).toBeNull()
    await expect(within(canvasElement).queryByRole('progressbar')).toBeNull()
  },
}

export const CompletedRefreshFeedbackDisappears: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    publishSyncStatus({ ...initialSyncStatus, phase: 'saving', processed: 1, total: 2 })
    await canvas.findByRole('progressbar', { name: 'Session refresh progress' })
    publishSyncStatus({
      ...initialSyncStatus,
      phase: 'ready',
      lastSuccessfulSyncAt: new Date().toISOString(),
    })
    await waitFor(() => expect(canvas.queryByRole('progressbar')).toBeNull())
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(canvas.queryByText(/Syncing/)).toBeNull()
  },
}

export const CommittedRefreshRereadsSessionList: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed)
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const added = {
      ...session,
      id: 'synced-session',
      title: { text: 'A Session found by Refresh', source: 'first-prompt' as const },
    }
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    const reads = sessionListReads.mock.calls.length
    publishSessionSyncEvent({ type: 'committed' })
    sessionsHost?.announce([added])
    await expect(
      await canvas.findByRole('button', { name: /A Session found by Refresh/ }),
    ).toBeVisible()
    // An announced change reads the loaded pages again.
    await expect(sessionListReads.mock.calls.length).toBeGreaterThan(reads)
  },
}

// The list re-sorts by activity, so a row that moves to a new index must carry its DOM node with
// it instead of swapping content into whatever node sits at that index now (#2852): the swap is
// what restarts the harness spin and status-dot transitions on unrelated rows, and it also drops
// keyboard focus a reader was holding on a row that only moved, never disappeared.
export const ReorderKeepsRowFocus: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost([
      { ...session, id: 'alpha', title: { text: 'Alpha session', source: 'first-prompt' } },
      { ...session, id: 'beta', title: { text: 'Beta session', source: 'first-prompt' } },
    ])
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const beta = await canvas.findByRole('button', { name: /Beta session/ })
    beta.focus()
    await expect(beta).toHaveFocus()
    // A lower sort order lists first, so beta moves above alpha.
    sessionsHost?.announce([
      {
        ...session,
        id: 'beta',
        sortOrder: -1,
        title: { text: 'Beta session', source: 'first-prompt' },
      },
    ])
    await waitFor(() => {
      const sessionButtons = canvas
        .getAllByRole('button')
        .filter((button) => button.dataset.sessionId !== undefined)
      expect(sessionButtons[0]?.dataset.sessionId).toBe('beta')
    })
    await expect(canvas.getByRole('button', { name: /Beta session/ })).toHaveFocus()
  },
}

// A title that fell back to the opening prompt draws its skill mention as a badge, not the raw
// markdown-link brackets (#2049).
export const SkillMentionTitle: Story = {
  beforeEach: () =>
    showingSessions([
      {
        ...session,
        title: {
          text: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
          source: 'first-prompt',
        },
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Implement/ })
    await expect(row).not.toHaveTextContent('[$implement]')
    await expect(row.querySelector('svg')).not.toBeNull()
    await expect(row).toHaveTextContent('https://github.com/milad-alizadeh/argo/issues/1944')
    await expect(row.querySelector('a')).toBeNull()
  },
}

let sessionsHost: ReturnType<typeof withSessionsHost> | null = null

export const FocusRecovery: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed)
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const removed = await canvas.findByRole('button', { name: /A second Session/ })
    removed.focus()
    await expect(removed).toHaveFocus()
    // An archived row leaves the active list.
    sessionsHost?.announce([{ ...secondSession, archived: true }])
    const survivor = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await waitFor(async () => {
      await expect(survivor).toHaveFocus()
      await expect(survivor).toHaveAttribute('tabindex', '0')
    })
  },
}

export const Loading: Story = {
  beforeEach: () => withSessionListHost(() => new Promise(() => {})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Reading Sessions' })).toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9)
  },
}
export const Empty: Story = {
  beforeEach: () => showingSessions([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
    await expect(
      canvas.getByText('No Sessions found').closest('[data-slot="empty"]'),
    ).not.toBeNull()
  },
}
// The Archive is a choice in the header's filter (#2239), so every archived story reaches it the way
// a reader does. The menu renders in a portal.
async function chooseStatus(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Filter Sessions' }))
  await userEvent.click(await within(document.body).findByRole('menuitemradio', { name }))
}

const archivedSession: Session = {
  ...session,
  id: 'archived-session',
  customTitle: null,
  preview: null,
  archived: true,
  title: { text: 'Read the archived transcript', source: 'first-prompt' },
}

// The archived filter is a filter on the one list query, so choosing it reads `filter: 'archived'`.
export const WithArchive: Story = {
  beforeEach: () => showingSessions([...listed, archivedSession]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(canvas.queryByRole('button', { name: /Read the archived transcript/ })).toBeNull()
    await chooseStatus(canvasElement, 'Archived')
    await expect(
      await canvas.findByRole('button', { name: /Read the archived transcript/ }),
    ).toBeVisible()
    await expect(sessionListReads).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'project-1', filter: 'archived', offset: 0 }),
    )
    await expect(canvas.queryByRole('button', { name: /Read the Session transcript/ })).toBeNull()
  },
}

export const ArchivedRowsCanBeOpened: Story = {
  render: (args) => <SessionListHarness {...args} />,
  beforeEach: () =>
    showingSessions([
      {
        ...archivedSession,
        title: { text: 'Open the archived transcript', source: 'first-prompt' },
      },
    ]),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await userEvent.click(
      await canvas.findByRole('button', { name: /Open the archived transcript/ }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith('archived-session')
  },
}

// An archived filter with no rows draws the list's own empty outcome.
export const ArchiveEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await chooseStatus(canvasElement, 'Archived')
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
  },
}

// Archiving lives on the row's context menu, with no bulk action bar footer (#2194 follow-up).
export const ArchiveFromContextMenu: Story = {
  args: { onArchiveSelected: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    const archive = await within(document.body).findByRole('menuitem', { name: 'Archive' })
    await userEvent.click(archive)
    await expect(args.onArchiveSelected).toHaveBeenCalledWith(['prose'])
  },
}

function ArchivingSessionList(args: SessionListHarnessArgs) {
  return <SessionListHarness {...args} onArchiveSelected={useArchiveSelected()} />
}

// A bulk archive and its Undo are one Session update per row, and the list reads its pages again.
export const BulkArchiveAndUndoUpdateEachSession: Story = {
  render: (args) => <ArchivingSessionList {...args} />,
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed)
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    const second = canvas.getByRole('button', { name: /A second Session/ })
    const reads = sessionListReads.mock.calls.length
    // One session keeps Meta held across both clicks.
    const user = userEvent.setup()
    await user.keyboard('{Meta>}')
    await user.click(first)
    await user.click(second)
    await user.keyboard('{/Meta}')
    await userEvent.pointer({ keys: '[MouseRight]', target: first })
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Archive' }))
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
    await expect(sessionUpdates.mock.calls.map(([update]) => update)).toEqual([
      { sessionIds: ['prose', 'second-session'], archived: true },
    ])
    await userEvent.click(await within(document.body).findByRole('button', { name: 'Undo' }))
    await expect(
      await canvas.findByRole('button', { name: /Read the Session transcript/ }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /A second Session/ })).toBeVisible()
    await expect(sessionUpdates.mock.calls.slice(1).map(([update]) => update)).toEqual([
      { sessionIds: ['prose', 'second-session'], archived: false },
    ])
    await expect(sessionListReads.mock.calls.length).toBeGreaterThan(reads)
  },
}

export const Failure: Story = {
  beforeEach: () => withSessionListHost(async () => readFailure),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const alert = await canvas.findByRole('alert')
    await expect(alert).toHaveAttribute('data-slot', 'alert')
    await expect(alert).toHaveTextContent('Unable to load Sessions')
    await expect(alert).toHaveTextContent('Argo could not read these Sessions.')
  },
}

// The list reads its next offset page when the reader sees its last loaded row, and at no other
// time. The virtualizer mounts 30 rows of overscan, so a mounted last row is not a seen one (#2277).
const manySessions: Session[] = Array.from({ length: 80 }, (_unused, row) => ({
  ...session,
  id: `session-${String(row).padStart(2, '0')}`,
  title: { text: `Session number ${row}`, source: 'first-prompt' as const },
}))

function sessionListScroll(canvasElement: HTMLElement) {
  const scroll = canvasElement.querySelector<HTMLElement>('[data-slot="session-list-scroll"]')
  if (scroll === null) throw new Error('The sessionList has no scrolled container.')
  return scroll
}

export const GrowsOnlyWhenTheReaderReachesTheEnd: Story = {
  beforeEach: () => withSessionListHost(async (read) => listPage(manySessions, read)),
  play: async ({ canvasElement }) => {
    const scroll = await waitFor(() => sessionListScroll(canvasElement))
    const listSessions = sessionListReads
    await expect(scroll.scrollTop).toBe(0)
    await expect(listSessions).toHaveBeenCalledTimes(1)
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    // Reaching the last row asks for one page, at the offset of the rows already loaded.
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2))
    await expect(listSessions).toHaveBeenLastCalledWith({
      projectId: 'project-1',
      filter: 'active',
      search: '',
      offset: 30,
      limit: 30,
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(listSessions).toHaveBeenCalledTimes(2)
  },
}

// A page shorter than the viewport leaves its last row visible with nothing to scroll, so it asks
// once, rather than growing the Session list page after page on its own.
export const AsksOnceWhenTheWindowDoesNotFillTheViewport: Story = {
  beforeEach: () => {
    const third = { ...session, id: 'third-session' }
    return withSessionListHost(async ({ offset }) =>
      offset === 0 ? { total: 3, rows: listed } : { total: 3, rows: [third] },
    )
  },
  play: async () => {
    const listSessions = sessionListReads
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2))
    await expect(listSessions).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(listSessions).toHaveBeenCalledTimes(2)
  },
}

// The spinner stands where the rows it waits for will be: one Session row tall, after the list, with
// the spinner centered in it and no border of its own.
export const GrowingTheWindow: Story = {
  beforeEach: () =>
    withSessionListHost((read) =>
      read.offset === 0
        ? Promise.resolve(listPage(manySessions, read))
        : new Promise(() => {
            // The second page never lands, so the Session list stays on its loading-more row.
          }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroll = await waitFor(() => sessionListScroll(canvasElement))
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    const spinner = await canvas.findByRole('status', { name: 'Loading more Sessions' })
    await expect(spinner).toBeVisible()
    await expect(spinner.getBoundingClientRect().height).toBe(56)
    await expect(spinner.querySelector('[data-slot="loader"]')).toBeNull()
    await expect(spinner.querySelector('svg.animate-spin')).not.toBeNull()
    const lastRow = [
      ...canvas.getByRole('navigation', { name: 'Sessions' }).querySelectorAll('li'),
    ].at(-1)
    await expect(spinner.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      lastRow?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
    )
  },
}

async function typeSearch(canvasElement: HTMLElement, query: string) {
  const canvas = within(canvasElement)
  const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
  await userEvent.click(search)
  await userEvent.keyboard(query)
}

export const SearchFiltersCustomTitlesAndPreviews: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'second')
    await waitFor(() => expectOnlySecondSession(canvas, /Read the Session transcript/))
  },
}

export const SearchNoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'nothing indexed holds this')
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
    await expect(canvas.queryByText('No Sessions match your search')).toBeNull()
  },
}

export const SearchDoesNotShowInitialSkeleton: Story = {
  beforeEach: () => {
    let resolveSearch: ((result: SessionListResult) => void) | null = null
    const pendingSearch = new Promise<SessionListResult>((resolve) => {
      resolveSearch = resolve
    })
    const restore = withSessionListHost((read) =>
      read.search === '' ? Promise.resolve(listPage(listed, read)) : pendingSearch,
    )
    return () => {
      resolveSearch?.({ total: 0, rows: [] })
      restore()
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await typeSearch(canvasElement, 'absent')
    await waitFor(() =>
      expect(sessionListReads).toHaveBeenCalledWith(expect.objectContaining({ search: 'absent' })),
    )
    await expect(canvas.getByRole('button', { name: /Read the Session transcript/ })).toBeVisible()
    await expect(canvas.queryByRole('status', { name: 'Reading Sessions' })).toBeNull()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
  },
}

// Typing reads the list once, for the settled text, rather than once per keystroke.
export const SearchWaitsForTypingToSettle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await typeSearch(canvasElement, 'second')
    await waitFor(() => expectOnlySecondSession(canvas, /Read the Session transcript/))
    await expect(sessionListReads.mock.calls.map(([read]) => read.search)).toEqual(['', 'second'])
  },
}

// A search with more results than one page reads its next offset the way browsing does.
export const SearchGrowsPastTheFirstPage: Story = {
  beforeEach: () =>
    withSessionListHost(async (read) => listPage(read.search === '' ? listed : manySessions, read)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await typeSearch(canvasElement, 'number')
    await canvas.findAllByRole('button', { name: /Session number/ })
    const scroll = sessionListScroll(canvasElement)
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    await waitFor(() =>
      expect(sessionListReads).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'number', offset: 30 }),
      ),
    )
  },
}

function ProjectSwitchingSessionList(args: SessionListHarnessArgs) {
  const [projectId, setProjectId] = useState('project-1')
  return (
    <>
      <button onClick={() => setProjectId('project-2')} type="button">
        Open the second Project
      </button>
      <SessionList
        actions={args}
        projectId={projectId}
        selectedSessionId={args.selectedSessionId}
      />
    </>
  )
}

function projectSessions(projectId: string): Session[] {
  return [false, true].map((archived) => {
    const name = `${archived ? 'Archived' : 'Active'} in ${projectId}`
    return {
      ...session,
      id: `${projectId}-${archived ? 'archived' : 'active'}`,
      projectId,
      archived,
      customTitle: name,
      preview: null,
      title: { text: name, source: 'first-prompt' },
    }
  })
}

// Another Project reads its own active and archived rows, keeping the search the reader typed.
export const ProjectSwitchReadsThatProject: Story = {
  render: (args) => <ProjectSwitchingSessionList {...args} />,
  beforeEach: () =>
    showingSessions([...projectSessions('project-1'), ...projectSessions('project-2')]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'All')
    await canvas.findByRole('button', { name: /Archived in project-1/ })
    await typeSearch(canvasElement, 'active')
    await waitFor(() =>
      expect(sessionListReads).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1', filter: 'all', search: 'active' }),
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open the second Project' }))
    await canvas.findByRole('button', { name: /Active in project-2/ })
    await expect(sessionListReads).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'project-2', filter: 'all', search: 'active' }),
    )
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Search Sessions' }))
    await canvas.findByRole('button', { name: /Archived in project-2/ })
    await expect(canvas.queryByRole('button', { name: /Archived in project-1/ })).toBeNull()
  },
}

// Until the typed text settles, the list is still the unsearched one, archived rows included.
export const UnsettledSearchKeepsTheArchive: Story = {
  beforeEach: () => showingSessions([...listed, archivedSession]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'All')
    await canvas.findByRole('button', { name: /Read the archived transcript/ })
    await typeSearch(canvasElement, 's')
    await expect(canvas.getByRole('button', { name: /Read the archived transcript/ })).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: /Read the archived transcript/ })).toBeNull(),
    )
  },
}
