import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { sessionRow, sessionSubagent } from '@/mocks/sessions/session-rows'
import {
  installSessionHost,
  publishSessionSyncStatus,
  type SessionHost,
  storySessionPage,
} from '@/mocks/sessions/session-story-host'
import { replaceComposerCommands } from '../composer/references/composer-command-registry'
import { useFeedReading } from '../feed/use-feed-reading'
import type { Session, SessionError, SessionListResult } from '../types'
import { SessionList } from './session-list'

const session = sessionRow({
  id: 'prose',
  posture: null,
  name: 'Read the Session transcript',
  status: 'idle',
  cwd: '/workspace/argo',
  subagents: [sessionSubagent({ id: 'interface-review', label: 'Interface review' })],
})

const secondSession: Session = {
  ...session,
  id: 'second-session',
  name: 'A second Session',
}

const listed: Session[] = [session, secondSession]

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-session-list-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

const SESSIONS_ROUTE = '/projects/storybook-project/sessions'

// The story's main process; each story installs a fresh one.
let host: SessionHost
function showing(...args: Parameters<typeof installSessionHost>) {
  host = installSessionHost(...args)
  return host
}

// The Session screen reads the open Session's Feed; this stands in for it.
function OpenSessionFeed() {
  useFeedReading(useParams().sessionId ?? null)
  return null
}

// A note, not an `output`: the stories count the list's status regions.
function RouteOutput() {
  const location = useLocation()
  return (
    <p aria-label="Session route" className="sr-only" role="note">
      {location.pathname + location.search}
    </p>
  )
}

const meta = {
  title: 'Sessions/SessionList',
  component: SessionList,
  parameters: { layout: 'fullscreen', route: SESSIONS_ROUTE },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={[parameters.route as string]}>
        <Routes>
          <Route
            path="/projects/:projectId/sessions/:sessionId?"
            element={
              <>
                <div className="h-dvh w-80">
                  <Story />
                </div>
                <OpenSessionFeed />
                <RouteOutput />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
  beforeEach: () => showing(listed),
} satisfies Meta<typeof SessionList>

export default meta
type Story = StoryObj<typeof meta>

let historyAvailable = false

// A Session whose history is missing keeps its badge while another is open, until a read finds it.
export const UnavailableHistoryRecovers: Story = {
  parameters: { route: `${SESSIONS_ROUTE}/${session.id}` },
  beforeEach: () => {
    historyAvailable = false
    return showing(listed, {
      feed: async (sessionId) => {
        if (!historyAvailable && sessionId === session.id)
          throw Object.assign(new Error(readFailure.message), { data: { code: 'NOT_FOUND' } })
        return []
      },
    })
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
    historyAvailable = true
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

export const Discovered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
    await expect(search).toHaveAttribute('placeholder', 'Search Sessions…')
    await expect(canvas.getByRole('button', { name: 'New Session' })).toBeEnabled()
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(row).toHaveAccessibleName(/Idle/)
    await expect(row.querySelector('svg')).not.toBeNull()
    await userEvent.click(row)
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      `${SESSIONS_ROUTE}/prose`,
    )
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
      `${SESSIONS_ROUTE}/second-session`,
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
    await expect(host.updates).toEqual([
      { sessionIds: ['prose'], title: '  Keep the Session list stable' },
    ])
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      `${SESSIONS_ROUTE}/second-session`,
    )
    await expect(
      canvas.getAllByRole('button').filter((button) => button.dataset.sessionId),
    ).toHaveLength(2)
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
    const restore = showing([
      {
        ...session,
        name: '/implement 1847',
      },
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

// Optional activity metadata must not present `unknown` status as an activity summary.
export const MissingActivityKeepsStatusOutOfTheSubtitle: Story = {
  beforeEach: () =>
    showing([
      {
        ...session,
        activity: null,
        status: 'unknown',
        name: 'A Session with no observed activity',
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
    showing([
      {
        ...session,
        id: 'running-command',
        activity: {
          label: 'Ran bun run quality',
          kind: 'command',
          open: true,
        },
        status: 'running',
        name: 'Gate the branch',
      },
      {
        ...session,
        id: 'settled-command',
        activity: {
          label: 'Ran bun run quality',
          kind: 'command',
          open: true,
        },
        status: 'idle',
        name: 'Gated the branch',
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
    name: `${name} session`,
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
          },
  }))
}

export const ConcurrentActivityKeepsRowsStill: Story = {
  beforeEach: () => showing(concurrentActivityRows({})),
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
      host.change([row])
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
    showing([
      {
        ...session,
        id: 'commentary',
        activity: {
          label: '**Checking** the `tool-groups.ts` order',
          kind: 'thought',
          open: true,
        },
        status: 'running',
        name: 'Order the group phrases',
      },
      {
        ...session,
        id: 'literal-command',
        activity: {
          label: 'Ran ls *.ts *.tsx',
          kind: 'command',
          open: false,
        },
        status: 'idle',
        name: 'List the sources',
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
    showing([
      {
        ...session,
        activity: {
          label: 'Watch PR checks',
          kind: 'command',
          open: false,
        },
        status: 'running',
        plan: {
          state: 'available',
          entries: [
            { content: 'Inspect the sessionList', position: 0, status: 'completed' },
            { content: 'Match the layout', position: 1, status: 'in_progress' },
          ],
        },
        name: 'Codex session names displaying as ID',
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Watch PR checks')).toBeVisible()
    await expect(canvas.queryByText(/Bash RTK_DISABLED=1 gh pr checks 2062/)).toBeNull()
    await expect(canvas.getByLabelText('1 of 2 steps completed')).toBeVisible()
  },
}

// A row whose Feed held a Plan names its step count, with or without a live channel; an empty
// Plan names none.
export const RowShowsItsPlanStep: Story = {
  beforeEach: () =>
    showing([
      { ...session, planProgress: { completed: 1, total: 2 } },
      { ...secondSession, planProgress: { completed: 0, total: 0 } },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const planned = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(within(planned).getByText('Step 1/2')).toBeVisible()
    const unplanned = canvas.getByRole('button', { name: /A second Session/ })
    await expect(within(unplanned).queryByText(/^Step /)).toBeNull()
  },
}

// A settled row says how long ago it last changed; a working one shows no time.
export const SettledRowShowsItsAge: Story = {
  beforeEach: () => {
    const eightMinutesAgo = new Date(Date.now() - 8 * 60_000 - 1000).toISOString()
    return showing([
      { ...session, updatedAt: eightMinutesAgo },
      { ...secondSession, status: 'running', updatedAt: eightMinutesAgo },
    ])
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const settled = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(within(settled).getByText('8m')).toHaveAttribute('title', 'Updated 8m ago')
    const working = canvas.getByRole('button', { name: /A second Session/ })
    await expect(working.querySelector('time')).toBeNull()
  },
}

function statusOf(row: HTMLElement) {
  return row.querySelector('[data-slot="session-status"]')?.getAttribute('data-variant')
}

function harnessActive(row: HTMLElement) {
  return row.querySelector('[data-slot="harness-logo"]')?.getAttribute('data-active')
}

// Each status draws its dot; both blocked statuses share one "Needs input" badge (#2509), a
// starting Session keeps the idle mark, and a running one spins its Harness logo.
export const StatusMarks: Story = {
  beforeEach: () =>
    showing([
      session,
      {
        ...session,
        id: 'wants-answer',
        posture: 'live',
        status: 'asking',
        name: 'A question is waiting',
      },
      {
        ...session,
        id: 'wants-permission',
        status: 'permission',
        name: 'A tool call is waiting',
      },
      {
        ...session,
        id: 'starting-session',
        status: 'starting',
        name: 'New Session',
      },
      {
        ...session,
        id: 'running-session',
        status: 'running',
        name: 'Build the approved layout',
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const wantsAnswer = await canvas.findByRole('button', { name: /A question is waiting/ })
    await expect(within(wantsAnswer).getByText('Needs input')).toBeVisible()
    await expect(statusOf(wantsAnswer)).toBe('attention')
    const wantsPermission = canvas.getByRole('button', { name: /A tool call is waiting/ })
    await expect(within(wantsPermission).getByText('Needs input')).toBeVisible()
    await expect(statusOf(wantsPermission)).toBe('attention')
    const idle = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await expect(within(idle).queryByText('Needs input')).toBeNull()
    await expect(statusOf(idle)).toBe('idle')
    const starting = canvas
      .getAllByRole('button')
      .find((button) => button.dataset.sessionId === 'starting-session')
    if (starting === undefined) throw new Error('The starting Session row is absent.')
    await expect(statusOf(starting)).toBe('idle')
    await expect(harnessActive(starting)).toBe('false')
    const running = canvas.getByRole('button', { name: /Build the approved layout/ })
    await expect(running).toHaveAccessibleName(/Running/)
    await expect(running.querySelector('[data-slot="loader"]')).toBeNull()
    await expect(statusOf(running)).toBe('active')
    await expect(harnessActive(running)).toBe('true')
  },
}

// A changed status redraws the dot, and a resolved permission drops its badge.
export const StatusFollowsChanges: Story = {
  beforeEach: () =>
    showing([
      {
        ...session,
        id: 'waiting-for-permission',
        status: 'permission',
        name: 'Approve the command',
      },
      {
        ...session,
        id: 'idle-session',
        name: 'Read the idle Session',
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const waiting = await canvas.findByRole('button', { name: /Approve the command/ })
    const idle = canvas.getByRole('button', { name: /Read the idle Session/ })
    await expect(within(waiting).getByText('Needs input')).toBeVisible()
    await expect(statusOf(waiting)).toBe('attention')
    await expect(statusOf(idle)).toBe('idle')
    host.change([
      { ...session, id: 'waiting-for-permission', status: 'idle' },
      {
        ...session,
        id: 'idle-session',
        status: 'running',
        name: 'Read the idle Session',
      },
    ])
    await waitFor(async () => {
      await expect(statusOf(waiting)).toBe('idle')
      await expect(within(waiting).queryByText('Needs input')).toBeNull()
      await expect(statusOf(idle)).toBe('active')
    })
  },
}

// A lost change signal opens again and reads the list afresh, so a change made meanwhile lands.
export const LostChangeSignalReconnects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    host.dropChangeSignal([
      {
        ...session,
        name: 'Renamed while the signal was lost',
      },
    ])
    await canvas.findByRole(
      'button',
      { name: /Renamed while the signal was lost/ },
      { timeout: 3000 },
    )
  },
}

export const NarrowSidebarWithLongSessionName: Story = {
  beforeEach: () =>
    showing([
      {
        ...session,
        name: 'Keep the Sessions sidebar readable when a Session name is substantially longer than its pane',
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

// Refresh stays disabled while a sync runs, and its bar fills with the share saved.
// The first read's rows, so a story acts on the list rather than on its loading skeleton.
async function rowsShown(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelector('[data-session-id]')).not.toBeNull())
}

export const RefreshProgressWhileSyncing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const progress = () => canvas.getByRole('progressbar', { name: 'Session refresh progress' })
    await rowsShown(canvasElement)
    publishSessionSyncStatus({ phase: 'fetching' })
    await waitFor(() => expect(progress()).not.toHaveAttribute('aria-valuenow'))
    await expect(canvas.getAllByRole('progressbar')).toHaveLength(1)
    await expect(canvas.getByRole('status')).toHaveTextContent('Syncing Sessions…')
    const filter = canvas.getByRole('button', { name: 'Filter Sessions' })
    await userEvent.click(filter)
    await waitFor(() => expect(filter).toHaveAttribute('aria-expanded', 'true'))
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Refresh Sessions' }),
    ).toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(filter).toHaveAttribute('aria-expanded', 'false'))
    publishSessionSyncStatus({ phase: 'saving', processed: 1, total: 2 })
    await waitFor(() => expect(progress()).toHaveAttribute('aria-valuenow', '50'))
    await expect(canvas.getByRole('status')).toHaveTextContent('Syncing 1 out of 2 Sessions')
    publishSessionSyncStatus({ phase: 'saving', processed: 0, total: 0 })
    await waitFor(() => expect(progress()).toHaveAttribute('aria-valuenow', '100'))
  },
}

export const PartialRefreshShowsOneToast: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await rowsShown(canvasElement)
    publishSessionSyncStatus({ phase: 'ready', skipped: 2 })
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
    await rowsShown(canvasElement)
    publishSessionSyncStatus({ phase: 'failed', failure: 'Reader unavailable.' })
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
    await rowsShown(canvasElement)
    publishSessionSyncStatus({ phase: 'saving', processed: 1, total: 2 })
    await canvas.findByRole('progressbar', { name: 'Session refresh progress' })
    publishSessionSyncStatus({
      phase: 'ready',
    })
    await waitFor(() => expect(canvas.queryByRole('progressbar')).toBeNull())
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(canvas.queryByText(/Syncing/)).toBeNull()
  },
}

const alpha: Session = {
  ...session,
  id: 'alpha',
  name: 'Alpha session',
}
const beta: Session = {
  ...session,
  id: 'beta',
  name: 'Beta session',
}
let reordered = false

// A row that moves carries its DOM node, so the reader keeps focus on it (#2852).
export const ReorderKeepsRowFocus: Story = {
  beforeEach: () => {
    reordered = false
    return showing([alpha, beta], {
      list: async (read) => storySessionPage(reordered ? [beta, alpha] : [alpha, beta], read),
    })
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Beta session/ })
    row.focus()
    await expect(row).toHaveFocus()
    reordered = true
    host.change([beta])
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
    showing([
      {
        ...session,
        name: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
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

export const FocusRecovery: Story = {
  beforeEach: () => showing(listed),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const removed = await canvas.findByRole('button', { name: /A second Session/ })
    removed.focus()
    await expect(removed).toHaveFocus()
    // An archived row leaves the active list.
    host.change([{ ...secondSession, archived: true }])
    const survivor = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await waitFor(async () => {
      await expect(survivor).toHaveFocus()
      await expect(survivor).toHaveAttribute('tabindex', '0')
    })
  },
}

export const Loading: Story = {
  beforeEach: () => showing([], { list: () => new Promise(() => {}) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Reading Sessions' })).toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9)
  },
}
export const Empty: Story = {
  beforeEach: () => showing([]),
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
  archived: true,
  name: 'Read the archived transcript',
}

// The archived filter is a filter on the one list query, so choosing it reads `filter: 'archived'`.
export const WithArchive: Story = {
  beforeEach: () => showing([...listed, archivedSession]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(canvas.queryByRole('button', { name: /Read the archived transcript/ })).toBeNull()
    await chooseStatus(canvasElement, 'Archived')
    await expect(
      await canvas.findByRole('button', { name: /Read the archived transcript/ }),
    ).toBeVisible()
    await expect(host.reads.at(-1)).toMatchObject({
      projectId: 'storybook-project',
      filter: 'archived',
      offset: 0,
    })
    await expect(canvas.queryByRole('button', { name: /Read the Session transcript/ })).toBeNull()
  },
}

export const ArchivedRowsCanBeOpened: Story = {
  beforeEach: () =>
    showing([
      {
        ...archivedSession,
        name: 'Open the archived transcript',
      },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await userEvent.click(
      await canvas.findByRole('button', { name: /Open the archived transcript/ }),
    )
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      `${SESSIONS_ROUTE}/archived-session?status=archived`,
    )
  },
}

// Closes the Undo toast of an archive, which ends its Undo window.
async function closeArchivedToast(count = 1) {
  const name = `Archived ${count} Session${count === 1 ? '' : 's'}`
  const toast = await within(document.body).findByRole('dialog', { name })
  // The close control joins the accessibility tree once the toasts expand under the pointer.
  await userEvent.hover(toast)
  await userEvent.click(await within(toast).findByRole('button', { name: 'Close toast' }))
}

// Archiving lives on the row's context menu, with no bulk action bar footer (#2194 follow-up).
// The clean worktree goes only once the Undo window closes.
export const ArchiveFromContextMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    const archive = await within(document.body).findByRole('menuitem', { name: 'Archive' })
    await userEvent.click(archive)
    await expect(host.updates).toEqual([{ sessionIds: ['prose'], archived: true }])
    await expect(host.removals).toEqual([])
    await closeArchivedToast()
    await waitFor(() =>
      expect(host.removals).toEqual([{ sessionIds: ['prose'], removal: 'clean' }]),
    )
  },
}

const heldWork = {
  sessionId: 'prose',
  path: '/workspace/argo-worktrees/prose',
  branch: 'argo/prose',
  changedFiles: 2,
  ownCommits: 1,
}

async function archiveFirstRow(canvasElement: HTMLElement) {
  const row = await within(canvasElement).findByRole('button', {
    name: /Read the Session transcript/,
  })
  await userEvent.pointer({ keys: '[MouseRight]', target: row })
  await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Archive' }))
  return within(document.body).findByRole('alertdialog')
}

// A worktree that holds work asks first; Keep archives and leaves the worktree.
export const ArchiveAsksBeforeRemovingWork: Story = {
  beforeEach: () => showing(listed, { worktreeWork: async () => ({ worktrees: [heldWork] }) }),
  play: async ({ canvasElement }) => {
    const dialog = await archiveFirstRow(canvasElement)
    await waitFor(() => expect(within(dialog).getByText('argo/prose')).toBeVisible())
    await expect(host.updates).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(host.updates).toEqual([{ sessionIds: ['prose'], archived: true }]))
    await closeArchivedToast()
    await waitFor(() =>
      expect(host.removals).toEqual([{ sessionIds: ['prose'], removal: 'clean' }]),
    )
  },
}

// Remove archives and asks main to remove the worktree even though it holds work.
export const ArchiveRemovesWorkWhenAsked: Story = {
  beforeEach: () => showing(listed, { worktreeWork: async () => ({ worktrees: [heldWork] }) }),
  play: async ({ canvasElement }) => {
    const dialog = await archiveFirstRow(canvasElement)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(host.updates).toEqual([{ sessionIds: ['prose'], archived: true }]))
    await closeArchivedToast()
    await waitFor(() => expect(host.removals).toEqual([{ sessionIds: ['prose'], removal: 'all' }]))
  },
}

// A removal main refused is told, not left silent.
export const ArchiveTellsARefusedRemoval: Story = {
  beforeEach: () =>
    showing(listed, {
      worktreeWork: async () => ({ worktrees: [heldWork] }),
      removeWorktrees: async () => ({
        worktrees: [
          { sessionId: 'prose', path: heldWork.path, branch: heldWork.branch, outcome: 'refused' },
        ],
      }),
    }),
  play: async ({ canvasElement }) => {
    const dialog = await archiveFirstRow(canvasElement)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await closeArchivedToast()
    await waitFor(() =>
      expect(
        within(document.body).getByText(
          'Argo could not remove the worktree /workspace/argo-worktrees/prose.',
        ),
      ).toBeVisible(),
    )
  },
}

// Cancel archives nothing; a state Argo could not read names each worktree it could not check.
export const ArchiveAsksWhenWorkIsUnchecked: Story = {
  beforeEach: () =>
    showing(
      [
        {
          ...session,
          worktree: { path: heldWork.path, branch: heldWork.branch, base: 'main' },
        },
        secondSession,
      ],
      {
        worktreeWork: async () => {
          throw new Error('git could not be read')
        },
      },
    ),
  play: async ({ canvasElement }) => {
    const dialog = await archiveFirstRow(canvasElement)
    await waitFor(() =>
      expect(within(dialog).getByText(/Argo could not check the worktrees/)).toBeVisible(),
    )
    await expect(within(dialog).getByText('argo/prose')).toBeVisible()
    await expect(within(dialog).getByText(/changed files not checked/)).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(within(document.body).queryByRole('alertdialog')).toBeNull())
    await expect(host.updates).toEqual([])
  },
}

// A bulk archive and its Undo are one Session update per row, and the list reads its pages again.
export const BulkArchiveAndUndoUpdateEachSession: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    const second = canvas.getByRole('button', { name: /A second Session/ })
    const reads = host.reads.length
    // One session keeps Meta held across both clicks.
    const user = userEvent.setup()
    await user.keyboard('{Meta>}')
    await user.click(first)
    await user.click(second)
    await user.keyboard('{/Meta}')
    await userEvent.pointer({ keys: '[MouseRight]', target: first })
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Archive' }))
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
    await expect(host.updates).toEqual([
      { sessionIds: ['prose', 'second-session'], archived: true },
    ])
    await userEvent.click(await within(document.body).findByRole('button', { name: 'Undo' }))
    await expect(
      await canvas.findByRole('button', { name: /Read the Session transcript/ }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /A second Session/ })).toBeVisible()
    await expect(host.updates.slice(1)).toEqual([
      { sessionIds: ['prose', 'second-session'], archived: false },
    ])
    await expect(host.reads.length).toBeGreaterThan(reads)
    // Undo kept the worktrees, so the window closing removes none.
    await closeArchivedToast(2)
    await waitFor(() =>
      expect(
        within(document.body).queryByRole('dialog', { name: 'Archived 2 Sessions' }),
      ).toBeNull(),
    )
    await expect(host.removals).toEqual([])
  },
}

export const Failure: Story = {
  beforeEach: () => showing([], { list: async () => readFailure }),
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
  name: `Session number ${row}`,
}))

function sessionListScroll(canvasElement: HTMLElement) {
  const scroll = canvasElement.querySelector<HTMLElement>('[data-slot="session-list-scroll"]')
  if (scroll === null) throw new Error('The sessionList has no scrolled container.')
  return scroll
}

export const GrowsOnlyWhenTheReaderReachesTheEnd: Story = {
  beforeEach: () => showing(manySessions),
  play: async ({ canvasElement }) => {
    await rowsShown(canvasElement)
    const scroll = await waitFor(() => sessionListScroll(canvasElement))
    await expect(scroll.scrollTop).toBe(0)
    await expect(host.reads).toHaveLength(1)
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    // Reaching the last row asks for one page, at the offset of the rows already loaded.
    await waitFor(() => expect(host.reads).toHaveLength(2))
    await expect(host.reads.at(-1)).toEqual({
      projectId: 'storybook-project',
      filter: 'active',
      search: '',
      offset: 30,
      limit: 30,
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(host.reads).toHaveLength(2)
  },
}

// A page shorter than the viewport leaves its last row visible with nothing to scroll, so it asks
// once, rather than growing the Session list page after page on its own.
export const AsksOnceWhenTheWindowDoesNotFillTheViewport: Story = {
  beforeEach: () => {
    const third = { ...session, id: 'third-session' }
    return showing([], {
      list: async ({ offset }) =>
        offset === 0 ? { total: 3, rows: listed } : { total: 3, rows: [third] },
    })
  },
  play: async () => {
    await waitFor(() => expect(host.reads).toHaveLength(2))
    await expect(host.reads.at(-1)).toMatchObject({ offset: 2 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(host.reads).toHaveLength(2)
  },
}

// The spinner stands where the rows it waits for will be: one Session row tall, after the list, with
// the spinner centered in it and no border of its own.
export const GrowingTheWindow: Story = {
  beforeEach: () =>
    showing([], {
      list: (read) =>
        read.offset === 0
          ? Promise.resolve(storySessionPage(manySessions, read))
          : new Promise(() => {
              // The second page never lands, so the Session list stays on its loading-more row.
            }),
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await rowsShown(canvasElement)
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

export const SearchDoesNotShowInitialSkeleton: Story = {
  beforeEach: () => {
    let resolveSearch: ((result: SessionListResult) => void) | null = null
    const pendingSearch = new Promise<SessionListResult>((resolve) => {
      resolveSearch = resolve
    })
    const restore = showing([], {
      list: (read) =>
        read.search === '' ? Promise.resolve(storySessionPage(listed, read)) : pendingSearch,
    })
    return () => {
      resolveSearch?.({ total: 0, rows: [] })
      restore()
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await typeSearch(canvasElement, 'absent')
    await waitFor(() => expect(host.reads.at(-1)).toMatchObject({ search: 'absent' }))
    await expect(canvas.getByRole('button', { name: /Read the Session transcript/ })).toBeVisible()
    await expect(canvas.queryByRole('status', { name: 'Reading Sessions' })).toBeNull()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
  },
}

function OpenSecondProject() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (
    <button
      onClick={() => navigate(`/projects/storybook-worktree/sessions${search}`)}
      type="button"
    >
      Open the second Project
    </button>
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
      name: name,
    }
  })
}

// Another Project reads its own active and archived rows, keeping the search the reader typed.
export const ProjectSwitchReadsThatProject: Story = {
  render: () => (
    <>
      <OpenSecondProject />
      <SessionList />
    </>
  ),
  beforeEach: () =>
    showing([], { list: async (read) => storySessionPage(projectSessions(read.projectId), read) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'All')
    await canvas.findByRole('button', { name: /Archived in storybook-project/ })
    await typeSearch(canvasElement, 'active')
    await waitFor(() =>
      expect(host.reads.at(-1)).toMatchObject({
        projectId: 'storybook-project',
        filter: 'all',
        search: 'active',
      }),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open the second Project' }))
    await canvas.findByRole('button', { name: /Active in storybook-worktree/ })
    await expect(host.reads.at(-1)).toMatchObject({
      projectId: 'storybook-worktree',
      filter: 'all',
      search: 'active',
    })
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Search Sessions' }))
    await canvas.findByRole('button', { name: /Archived in storybook-worktree/ })
    await expect(canvas.queryByRole('button', { name: /Archived in storybook-project/ })).toBeNull()
  },
}

// Until the typed text settles, the list is still the unsearched one, archived rows included, and
// the settled text is read once.
export const SearchWaitsForTypingToSettle: Story = {
  beforeEach: () =>
    showing([...listed, archivedSession], {
      list: async (read) =>
        storySessionPage(read.search === '' ? [...listed, archivedSession] : listed, read),
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'All')
    await canvas.findByRole('button', { name: /Read the archived transcript/ })
    await typeSearch(canvasElement, 'second')
    await expect(canvas.getByRole('button', { name: /Read the archived transcript/ })).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: /Read the archived transcript/ })).toBeNull(),
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(host.reads.map((read) => read.search)).toEqual(['', '', 'second'])
  },
}

// A Session with no title shows the same placeholder for each Harness, never its ID (#3167).
const untitled = (['claude', 'codex'] as const).map((harness) =>
  sessionRow({ id: `untitled-${harness}`, harness, posture: null, name: null }),
)

export const UntitledSessions: Story = {
  beforeEach: () => showing([session, ...untitled]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rows = await canvas.findAllByRole('button', { name: /Untitled Session/ })
    await expect(rows.map((row) => row.getAttribute('data-session-id'))).toEqual(
      untitled.map(({ id }) => id),
    )
    for (const row of rows) await expect(row).not.toHaveTextContent(/untitled-/)
  },
}
