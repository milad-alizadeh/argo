import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { sessionRosterRow, sessionSubagent } from '@/domains/sessions/renderer/session-fixtures'
import { useRosterFilterStore } from '@/domains/sessions/renderer/state/use-roster-filter-store'
import { useRosterWindowStore } from '@/domains/sessions/renderer/state/use-roster-window-store'
import type { SessionError, SessionId, SessionsListed } from '@/domains/sessions/renderer/types'
import { Roster, type RosterActions } from './roster'

const session = sessionRosterRow({
  id: 'prose',
  posture: 'external',
  title: { text: 'Read the Session transcript', source: 'first-prompt' },
  status: 'idle',
  cwd: '/workspace/argo',
  subagents: [sessionSubagent({ id: 'interface-review', label: 'Interface review' })],
}) satisfies SessionsListed['sessions'][number]

const listed = {
  version: 1,
  type: 'session.listed',
  requestId: 'storybook-sessions',
  sessions: [
    session,
    { ...session, id: 'second-session', title: { text: 'A second Session', source: 'summarised' } },
  ],
  filesFound: 1,
  filesRead: 1,
  filesUnreadable: 0,
  filesParsed: 0,
  nextCursor: null,
  historyComplete: true,
} satisfies SessionsListed

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-roster-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

function listedReply(roster: SessionsListed): SessionsListed {
  return roster
}

// The Roster reads its own Session list now (#2284), so every story that used to hand it a
// `roster` prop instead stands one window.argo.listSessions in for the read. The active Roster
// stories share this seam with the Archive stories below it, which already stub their own read
// the same way.
function withRosterHost(handler: (request: { cursor: string | null }) => Promise<unknown>) {
  const before = window.argo
  window.argo = { ...before, listSessions: handler as typeof before.listSessions }
  return () => {
    window.argo = before
  }
}

// A roster poll rebuilds its array on every tick regardless of whether anything changed
// (`keepRosterOrder` in `session-roster-query.ts`), so a rename or a focused row must survive a
// same-content rebuild rather than only the exact array a rename dialog closed against (#2290).
// `repoll` stands in for the watch that brings that rebuild, the same seam `useWatchedTopic` reads.
function withSessionsHost(initialSessions: SessionsListed['sessions']) {
  const before = window.argo
  let sessions = initialSessions
  // The roster's own invalidation and the Feed's `useWatchedQueries` each hold their own
  // subscription to this seam, so a single-slot stand-in silently dropped whichever subscribed
  // first (#2284).
  const listeners = new Set<(topic: 'sessions' | 'permissions') => void>()
  window.argo = {
    ...before,
    listSessions: () => Promise.resolve(listedReply({ ...listed, sessions })),
    onWatchedChanged: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    repoll(next: SessionsListed['sessions']) {
      sessions = next
      for (const listener of listeners) listener('sessions')
    },
    restore: () => {
      window.argo = before
    },
  }
}

type RosterHarnessArgs = RosterActions & { selectedSessionId: SessionId | null }

// The presentational seam Storybook drives: Roster's own props, plus the routing a real caller
// gives it. Project scoping plays no part in what a story renders, so every story reads the same
// null root and tells the roster apart by what window.argo.listSessions answers instead.
function RosterHarness({ selectedSessionId, ...actions }: RosterHarnessArgs) {
  return <Roster actions={actions} projectRoot={null} selectedSessionId={selectedSessionId} />
}

function RoutedRoster(args: RosterHarnessArgs) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedSessionId = location.pathname.split('/').at(-1) ?? null
  return (
    <>
      <RosterHarness
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

const meta: Meta<typeof RosterHarness> = {
  title: 'Sessions/Roster',
  component: RosterHarness,
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
  // The roster's paging window and remembered order live in one store shared by every mount
  // (#2277's fix for the poll racing the reader's own growth), so a story that grows it must not
  // leave that window for the next story to inherit.
  beforeEach: () => {
    useRosterWindowStore.setState({ cursors: {}, orders: {} })
    return withRosterHost(async () => listedReply(listed))
  },
  args: {
    onArchiveSelected: fn(),
    onLinkTicket: fn(),
    onNew: fn(),
    onOpenTicket: fn(),
    onRename: fn(async (_session, name) => name),
    onSelect: fn(),
    onUnlinkTicket: fn(),
    selectedSessionId: null,
  },
}

export default meta
type Story = StoryObj<typeof RosterHarness>

export const Discovered: Story = {
  render: (args) => <RoutedRoster {...args} />,
  // The trailing search interaction below reads through `window.argo.searchSessions` (#2375), not
  // the Roster's own loaded window, so this story stubs that seam too, filtered over the same
  // fixture titles a real title match would find.
  beforeEach: () => {
    const restoreSearch = withSearchHost(async (request) =>
      searchReply({
        sessions: listed.sessions.filter((candidate) =>
          (candidate.title?.text.toLocaleLowerCase() ?? '').includes(
            request.query.toLocaleLowerCase(),
          ),
        ),
      }),
    )
    return restoreSearch
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
    await expect(search).toHaveAttribute('placeholder', 'Search Sessions…')
    await expect(search).toHaveStyle({ fontSize: '13px', lineHeight: '19px' })
    await expect(canvas.getByRole('button', { name: 'New Session' })).toBeEnabled()
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await expect(row).toHaveAccessibleName(/Idle/)
    await expect(row.querySelector('svg')).not.toBeNull()
    await userEvent.click(row)
    await expect(args.onSelect).toHaveBeenCalledWith('prose')
    await expect(row).toHaveAttribute('aria-current', 'page')
    await expect(row).toHaveFocus()
    expect(getComputedStyle(row).outlineColor).toBe('rgba(0, 0, 0, 0)')
    const newSessionIcon = canvas.getByRole('button', { name: 'New Session' }).querySelector('svg')
    if (newSessionIcon === null) throw new Error('The New Session icon is absent.')
    expect(newSessionIcon.getBoundingClientRect().right).toBeCloseTo(
      row.getBoundingClientRect().right,
      1,
    )
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
    await userEvent.type(input, '  Keep the roster stable\n')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('button', { name: /Keep the roster stable/ })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Session route')).toHaveTextContent(
      '/sessions/second-session',
    )
    await expect(
      canvas.getAllByRole('button').filter((button) => button.dataset.sessionId),
    ).toHaveLength(2)
    await userEvent.click(search)
    await userEvent.keyboard('second')
    // The query debounces 250ms and answers through window.argo.searchSessions (#2375), so the
    // filtered result lands asynchronously rather than on the same tick as the keystroke.
    await expect(
      await canvas.findByRole('button', { name: /A second Session/ }),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /Keep the roster stable/ })).toBeNull()
  },
}

export const CommandTitledSession: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [{ ...session, title: { text: '/implement 1847', source: 'first-prompt' } }],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reference = await canvas.findByText('/implement')
    await expect(reference.closest('span.inline-flex')?.querySelector('svg')).not.toBeNull()
    await expect(canvas.getByRole('button', { name: /\/implement 1847/ })).toBeVisible()
  },
}

export const RunningSessionUsesLoader: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
          {
            ...session,
            status: 'running',
            title: { text: 'Build the approved roster layout', source: 'first-prompt' },
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Build the approved roster layout/ })
    await expect(row).toHaveAccessibleName(/Running/)
    const loader = row.querySelector<HTMLElement>('[data-slot="loader"]')
    if (loader === null) throw new Error('The running Session Loader is absent.')
    await expect(loader.getBoundingClientRect().width).toBe(12)
    await expect(loader.getBoundingClientRect().height).toBe(12)
    await expect(row.querySelector('[data-slot="session-status"]')).toHaveClass('bg-idle')
  },
}

// Optional activity metadata must not present `unknown` status as an activity summary.
export const MissingActivityKeepsStatusOutOfTheSubtitle: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
          {
            ...session,
            activity: null,
            status: 'unknown',
            title: { text: 'A Session with no observed activity', source: 'first-prompt' },
          },
        ],
      }),
    ),
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
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
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
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Running bun run quality')).toBeVisible()
    await expect(canvas.getByText('Ran bun run quality')).toBeVisible()
  },
}

export const RosterStructure: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
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
            turnStartedAt: '2026-09-14T03:30:00Z',
            plan: {
              state: 'available',
              entries: [
                { content: 'Inspect the roster', position: 0, status: 'completed' },
                { content: 'Match the layout', position: 1, status: 'in_progress' },
              ],
            },
            pullRequest: { number: 2062, repository: 'argo', url: 'https://example.com/pull/2062' },
            title: { text: 'Codex session names displaying as ID', source: 'first-prompt' },
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Watch PR checks')).toBeVisible()
    await expect(canvas.queryByText(/Bash RTK_DISABLED=1 gh pr checks 2062/)).toBeNull()
    await expect(
      canvasElement.querySelector('[data-slot="session-pull-request"] svg'),
    ).not.toBeNull()
    await expect(canvas.queryByText('#2062')).toBeNull()
    await expect(canvas.getByLabelText('1 of 2 steps completed')).toBeVisible()
    const timing = canvas.getByTitle(/^Running /)
    await expect(timing).toBeVisible()
    await expect(timing.parentElement?.firstElementChild).toBe(timing)
    await expect(canvas.getByText(/^(?:<1m|\d+[mhd])$/)).toBeVisible()
  },
}

// The dot beside a blocked Session is already `bg-warn` for both statuses; the badge is what
// names which one it is (#2088).
export const PendingBadges: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
          session,
          {
            ...session,
            id: 'wants-answer',
            posture: 'managed',
            status: 'asking',
            title: { text: 'A question is waiting', source: 'first-prompt' },
          },
          {
            ...session,
            id: 'wants-permission',
            status: 'permission',
            title: { text: 'A tool call is waiting', source: 'first-prompt' },
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const wantsAnswer = await canvas.findByRole('button', { name: /A question is waiting/ })
    await expect(within(wantsAnswer).getByText('Answer')).toBeVisible()
    const wantsPermission = canvas.getByRole('button', { name: /A tool call is waiting/ })
    const permissionBadge = within(wantsPermission).getByText('Permission Approval')
    await expect(permissionBadge).toHaveStyle({ fontSize: '13px', height: '16px' })
    const idle = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await expect(within(idle).queryByText('Answer')).toBeNull()
    await expect(within(idle).queryByText('Permission Approval')).toBeNull()
  },
}

export const NarrowSidebarWithLongSessionName: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
          {
            ...session,
            title: {
              text: 'Keep the Sessions sidebar readable when a Session name is substantially longer than its pane',
              source: 'first-prompt',
            },
          },
        ],
      }),
    ),
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

// A title that fell back to the opening prompt draws its skill mention as a badge, not the raw
// markdown-link brackets (#2049).
export const SkillMentionTitle: Story = {
  beforeEach: () =>
    withRosterHost(async () =>
      listedReply({
        ...listed,
        sessions: [
          {
            ...session,
            title: {
              text: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
              source: 'first-prompt',
            },
          },
        ],
      }),
    ),
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

export const RenameSurvivesRosterPoll: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed.sessions)
    return () => {
      sessionsHost?.restore()
      sessionsHost = null
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: /Read the Session transcript/ })
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    const rename = await within(document.body).findByRole('menuitem', { name: 'Rename' })
    await userEvent.click(rename)
    const dialog = within(document.body).getByRole('dialog', { name: 'Rename Session' })
    const input = within(dialog).getByRole('textbox', { name: 'Name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Keep the rename after a poll\n')
    await userEvent.keyboard('{Enter}')
    await expect(
      canvas.getByRole('button', { name: /Keep the rename after a poll/ }),
    ).toBeInTheDocument()
    sessionsHost?.repoll([...listed.sessions])
    await expect(
      canvas.getByRole('button', { name: /Keep the rename after a poll/ }),
    ).toBeInTheDocument()
  },
}

export const FocusRecovery: Story = {
  beforeEach: () => {
    sessionsHost = withSessionsHost(listed.sessions)
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
    sessionsHost?.repoll([session])
    const survivor = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await waitFor(async () => {
      await expect(survivor).toHaveFocus()
      await expect(survivor).toHaveAttribute('tabindex', '0')
    })
  },
}

export const Loading: Story = {
  beforeEach: () => withRosterHost(() => new Promise(() => {})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Reading Sessions' })).toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6)
  },
}
export const Empty: Story = {
  beforeEach: () => withRosterHost(async () => listedReply({ ...listed, sessions: [] })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No Sessions found')).toBeInTheDocument()
    await expect(
      canvas.getByText('No Sessions found').closest('[data-slot="empty"]'),
    ).not.toBeNull()
  },
}
// The Archive is a choice in the header's filter now, not a disclosure row in the list (#2239), so
// every archived story reaches it the way a reader does. The menu renders in a portal.
async function chooseStatus(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Filter Sessions' }))
  await userEvent.click(await within(document.body).findByRole('menuitemradio', { name }))
}

// The active Roster never carries an archived Session (#1593). Archived rows share the same
// scrolled list as the active ones (#2194 follow-up), so the filter adds its rows straight into
// this list rather than a separately scrolled block.
function withArchiveHost(
  handler: (request: { cursor: string | null; restoreId: string | null }) => Promise<unknown>,
) {
  const before = window.argo
  window.argo = { ...before, listArchivedSessions: handler as typeof before.listArchivedSessions }
  return () => {
    window.argo = before
  }
}

function archiveReply(fields: {
  sessions?: unknown[]
  nextCursor?: string | null
  restored?: unknown
  historyComplete?: boolean
}) {
  return {
    version: 1,
    type: 'session.archive.listed',
    requestId: 'storybook-archive',
    sessions: [],
    nextCursor: null,
    restored: null,
    historyComplete: true,
    ...fields,
  }
}

export const WithArchive: Story = {
  beforeEach: () =>
    withArchiveHost(async () =>
      archiveReply({
        sessions: [
          {
            ...session,
            id: 'archived-session',
            archived: true,
            title: { text: 'Read the archived transcript', source: 'first-prompt' },
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await waitFor(async () => {
      await expect(
        canvas.getByRole('button', { name: /Read the archived transcript/ }),
      ).toBeVisible()
    })
  },
}

export const ArchiveEmpty: Story = {
  beforeEach: () => withArchiveHost(async () => archiveReply({})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await waitFor(() => expect(canvas.getByText('No archived Sessions')).toBeInTheDocument())
  },
}

export const ArchiveLoading: Story = {
  beforeEach: () => withArchiveHost(() => new Promise(() => {})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await expect(
      canvas.getByRole('status', { name: 'Reading archived Sessions' }),
    ).toBeInTheDocument()
  },
}

export const ArchiveFailure: Story = {
  beforeEach: () =>
    withArchiveHost(async () => {
      throw new Error('archive read failed')
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await waitFor(async () => {
      const alert = canvas.getByRole('alert')
      await expect(alert).toHaveTextContent('Unable to load archived Sessions')
    })
  },
}

// A source's Session index still has older history to backfill (#2373, #2374): the Archive says so
// rather than presenting the current page as the whole thing.
export const ArchiveStillIndexing: Story = {
  beforeEach: () => withArchiveHost(async () => archiveReply({ historyComplete: false })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'Archived')
    await waitFor(() =>
      expect(canvas.getByText('Still indexing older Sessions')).toBeInTheDocument(),
    )
  },
}

// Two pages, each holding one Session: choosing the Archive reads the first, and the sentinel row
// reads the second on its own once it enters view, without repeating the first (#1593).
export const ArchiveLoadsFurtherPagesWithoutDuplicating: Story = {
  beforeEach: () =>
    withArchiveHost(async ({ cursor }) => {
      const first = { ...session, id: 'archived-first', archived: true }
      if (cursor === null) return archiveReply({ sessions: [first], nextCursor: 'page-2' })
      return archiveReply({ sessions: [{ ...first, id: 'archived-second' }] })
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await chooseStatus(canvasElement, 'All')
    await waitFor(async () => {
      const rows = canvas.getAllByRole('button').filter((button) => button.dataset.sessionId)
      await expect(rows).toHaveLength(4)
    })
  },
}

// A Session id the sidebar has selected but that never appears in the active Roster can only be
// archived: the section resolves and opens it on its own (#1593).
export const ArchiveRestored: Story = {
  args: { selectedSessionId: 'archived-first-session' },
  beforeEach: () =>
    withArchiveHost(async ({ restoreId }) =>
      archiveReply({
        restored:
          restoreId === 'archived-first-session'
            ? { ...session, id: 'archived-first-session', archived: true }
            : null,
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The reader asked for a Session that turns out to be archived, so the filter widens to All on
    // its own rather than leaving the list under a status that excludes what is selected.
    await waitFor(() =>
      expect(
        [...canvasElement.querySelectorAll('button[data-session-id]')].map(
          (row) => row.getAttribute('data-session-id') ?? '',
        ),
      ).toContain('archived-first-session'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Filter Sessions' }))
    await expect(
      await within(document.body).findByRole('menuitemradio', { name: 'All' }),
    ).toHaveAttribute('aria-checked', 'true')
  },
}

// Archiving lives on the row's context menu now, with no bulk action bar footer (#2194 follow-up).
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

export const Failure: Story = {
  beforeEach: () => withRosterHost(async () => readFailure),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const alert = await canvas.findByRole('alert')
    await expect(alert).toHaveAttribute('data-slot', 'alert')
    await expect(alert).toHaveTextContent('Unable to load Sessions')
    await expect(alert).toHaveTextContent('Argo could not read these Sessions.')
  },
}

// The roster's window grows when the reader reaches the bottom of what is loaded, and at no other
// time. The sentinel row is what "reached" means, and it is mounted well before it is visible: the
// virtualizer keeps 30 rows of overscan, so a sentinel below the fold used to count as reached and
// the roster grew a page before the reader had scrolled at all (#2277).
function manySessionsPage(index: number) {
  return {
    ...listed,
    sessions: Array.from({ length: 40 }, (_unused, row) => ({
      ...session,
      id: `session-${index}-${row}`,
      title: { text: `Session number ${row}`, source: 'first-prompt' as const },
    })),
    nextCursor: index === 0 ? 'page-2' : null,
  } satisfies SessionsListed
}

// The status filter is one store for the whole window, and ArchiveRestored widens it, so a story
// that reads the active roster says which status it starts from rather than inheriting one.
function showingActiveSessions() {
  useRosterFilterStore.setState({ status: 'active' })
}

function rosterScroll(canvasElement: HTMLElement) {
  const scroll = canvasElement.querySelector<HTMLElement>('[data-slot="roster-scroll"]')
  if (scroll === null) throw new Error('The roster has no scrolled container.')
  return scroll
}

export const GrowsOnlyWhenTheReaderReachesTheEnd: Story = {
  beforeEach: () => {
    showingActiveSessions()
    const listSessions = fn(async ({ cursor }: { cursor: string | null }) =>
      listedReply(manySessionsPage(cursor === null ? 0 : 1)),
    )
    return withRosterHost(listSessions)
  },
  play: async ({ canvasElement }) => {
    const scroll = await waitFor(() => rosterScroll(canvasElement))
    const listSessions = window.argo.listSessions as ReturnType<typeof fn>
    await expect(scroll.scrollTop).toBe(0)
    await expect(listSessions).toHaveBeenCalledTimes(1)
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    // One arrival of the sentinel asks for one page: the callback's identity changes with the
    // cursor the read returned, which used to ask again for as long as the sentinel stayed in view.
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2))
    await expect(listSessions).toHaveBeenCalledWith({ projectRoot: null, cursor: 'page-2' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(listSessions).toHaveBeenCalledTimes(2)
  },
}

// A window shorter than the viewport leaves the sentinel visible with nothing to scroll, so it is
// reached once and asks once, rather than growing the roster page after page on its own.
export const AsksOnceWhenTheWindowDoesNotFillTheViewport: Story = {
  beforeEach: () => {
    showingActiveSessions()
    const listSessions = fn(async ({ cursor }: { cursor: string | null }) =>
      listedReply(cursor === null ? { ...listed, nextCursor: 'page-2' } : listed),
    )
    return withRosterHost(listSessions)
  },
  play: async () => {
    const listSessions = window.argo.listSessions as ReturnType<typeof fn>
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(listSessions).toHaveBeenCalledTimes(2)
  },
}

// The spinner stands where the rows it waits for will be: one Session row tall, at the bottom of the
// list, with the spinner centered in it and no border of its own.
export const GrowingTheWindow: Story = {
  beforeEach: () => {
    showingActiveSessions()
    return withRosterHost(async ({ cursor }) =>
      cursor === null
        ? listedReply(manySessionsPage(0))
        : new Promise(() => {
            // The second page never lands, so the roster stays on its loading-more row.
          }),
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroll = await waitFor(() => rosterScroll(canvasElement))
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    const spinner = await canvas.findByRole('status', { name: 'Loading more Sessions' })
    await expect(spinner).toBeVisible()
    await expect(spinner.getBoundingClientRect().height).toBe(56)
    await expect(spinner.querySelector('[data-slot="loader"]')).toBeNull()
    await expect(spinner.querySelector('svg.animate-spin')).not.toBeNull()
    const rows = [...canvas.getByRole('navigation', { name: 'Sessions' }).querySelectorAll('li')]
    await expect(rows.indexOf(spinner.closest('li') as HTMLLIElement)).toBe(rows.length - 1)
  },
}

// A story-level fact declared once, and only tested here, so no other story is left to default it
// away by omission: with the window already complete, the sentinel never mounts at all (#2284).
export const NoSentinelWhenTheWindowIsComplete: Story = {
  beforeEach: () => {
    showingActiveSessions()
    return withRosterHost(async () => listedReply(listed))
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('button', { name: /Read the Session transcript/ })
    const scroll = rosterScroll(canvasElement)
    await expect(scroll.querySelectorAll('div[aria-hidden="true"]')).toHaveLength(0)
  },
}

// A live search reads through `window.argo.searchSessions`, not the Roster's own loaded window
// (#2375), so every search story stubs that seam on its own rather than `withRosterHost`.
function withSearchHost(
  handler: (request: { query: string; status: string; cursor: string | null }) => Promise<unknown>,
) {
  const before = window.argo
  window.argo = { ...before, searchSessions: handler as typeof before.searchSessions }
  return () => {
    window.argo = before
  }
}

function searchReply(fields: {
  sessions?: unknown[]
  nextCursor?: string | null
  historyComplete?: boolean
}) {
  return {
    version: 1,
    type: 'session.searched',
    requestId: 'storybook-search',
    sessions: [],
    nextCursor: null,
    historyComplete: true,
    ...fields,
  }
}

async function typeSearch(canvasElement: HTMLElement, query: string) {
  const canvas = within(canvasElement)
  const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
  await userEvent.click(search)
  await userEvent.keyboard(query)
}

// A title match reaches a Session the Roster's own window never loaded, proving the search reads
// through the shared reader's full indexed history rather than filtering what is already on
// screen (#2375).
export const SearchFindsATitleMatch: Story = {
  beforeEach: () =>
    withSearchHost(async () =>
      searchReply({
        sessions: [
          {
            ...session,
            id: 'outside-the-loaded-window',
            title: { text: 'Found far back in history', source: 'first-prompt' },
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'far back')
    await expect(
      await canvas.findByRole('button', { name: /Found far back in history/ }),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Read the Session transcript/ })).toBeNull()
  },
}

export const SearchNoMatches: Story = {
  beforeEach: () => withSearchHost(async () => searchReply({})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'nothing indexed holds this')
    await waitFor(() =>
      expect(canvas.getByText('No Sessions match your search')).toBeInTheDocument(),
    )
  },
}

// Background backfill (#2373) can still be walking older history while a search is already
// running: the empty page says so rather than presenting itself as the complete answer.
export const SearchStillIndexing: Story = {
  beforeEach: () => withSearchHost(async () => searchReply({ historyComplete: false })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'still indexing')
    await waitFor(() =>
      expect(canvas.getByText('Still indexing older Sessions')).toBeInTheDocument(),
    )
  },
}

export const SearchFailure: Story = {
  beforeEach: () =>
    withSearchHost(async () => {
      throw new Error('search failed')
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await typeSearch(canvasElement, 'anything')
    await waitFor(async () => {
      const alert = canvas.getByRole('alert')
      await expect(alert).toHaveTextContent('Unable to search Sessions')
    })
  },
}
