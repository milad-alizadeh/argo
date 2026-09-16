import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { sessionDelegation, sessionRosterRow } from '../../session-fixtures'
import { useRosterFilterStore } from '../../state/use-roster-filter-store'
import type { SessionError, SessionsListed } from '../../types'
import { SessionsSidebarContent, type SessionsSidebarContentProps } from './sessions-sidebar'

const session = sessionRosterRow({
  id: 'prose',
  posture: 'external',
  title: { text: 'Read the Session transcript', source: 'first-prompt' },
  status: 'idle',
  cwd: '/workspace/argo',
  delegations: [sessionDelegation({ id: 'interface-review', label: 'Interface review' })],
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
  nextCursor: null,
} satisfies SessionsListed

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-roster-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

function RoutedRoster(args: SessionsSidebarContentProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedSessionId = location.pathname.split('/').at(-1) ?? null
  return (
    <>
      <SessionsSidebarContent
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

// A roster poll rebuilds its array on every tick regardless of whether anything changed
// (`keepRosterOrder` in `session-roster-query.ts`), so a rename must survive a same-content
// rebuild rather than only the exact array a rename dialog closed against (#2290).
function RenameSurvivesPollRoster(args: SessionsSidebarContentProps) {
  const [roster, setRoster] = useState(listed)
  useEffect(() => {
    const repoll = () => setRoster({ ...listed, sessions: [...listed.sessions] })
    window.addEventListener('story:repoll', repoll)
    return () => window.removeEventListener('story:repoll', repoll)
  }, [])
  return <SessionsSidebarContent {...args} roster={roster} />
}

function FocusRecoveryRoster(args: SessionsSidebarContentProps) {
  const [roster, setRoster] = useState(listed)
  useEffect(() => {
    const removeFocusedSession = () => setRoster({ ...listed, sessions: [session] })
    window.addEventListener('story:remove-focused-session', removeFocusedSession)
    return () => window.removeEventListener('story:remove-focused-session', removeFocusedSession)
  }, [])
  return <SessionsSidebarContent {...args} roster={roster} />
}

const meta: Meta<typeof SessionsSidebarContent> = {
  title: 'Sessions/Roster',
  component: SessionsSidebarContent,
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
  args: {
    hasProject: true,
    onRename: fn(async (_session, name) => name),
    onSelect: fn(),
    roster: listed,
    rosterError: null,
    selectedSessionId: null,
  },
}

export default meta
type Story = StoryObj<typeof SessionsSidebarContent>

export const Discovered: Story = {
  render: (args) => <RoutedRoster {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search Sessions' })
    await expect(search).toHaveAttribute('placeholder', 'Search Sessions…')
    await expect(search).toHaveStyle({ fontSize: '13px', lineHeight: '19px' })
    await expect(canvas.getByRole('button', { name: 'New Session' })).toBeEnabled()
    const row = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await expect(row).toHaveAccessibleName(/Idle/)
    await expect(row.querySelector('svg')).not.toBeNull()
    await userEvent.click(row)
    await expect(args.onSelect).toHaveBeenCalledWith('prose')
    await expect(row).toHaveAttribute('aria-current', 'page')
    const newSessionIcon = canvas.getByRole('button', { name: 'New Session' }).querySelector('svg')
    if (newSessionIcon === null) throw new Error('The New Session icon is absent.')
    expect(newSessionIcon.getBoundingClientRect().right).toBeCloseTo(
      row.getBoundingClientRect().right,
      1,
    )
    await userEvent.keyboard('{ArrowDown}')
    const second = canvas.getByRole('button', { name: /A second Session/ })
    await expect(second).toHaveFocus()
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
    await expect(canvas.queryByRole('button', { name: /Keep the roster stable/ })).toBeNull()
    await expect(canvas.getByRole('button', { name: /A second Session/ })).toBeInTheDocument()
  },
}

// With no Project selected, the "+" control has nothing to create a Session on: clicking it names
// the next step instead of opening the composer #2109 already covers (#2307).
export const NoProjectSelected: Story = {
  args: { hasProject: false, onNew: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const newSessionButton = canvas.getByRole('button', { name: 'New Session' })
    await expect(canvas.queryByText('Select a Project first')).toBeNull()
    await userEvent.click(newSessionButton)
    await waitFor(async () => {
      await expect(
        within(document.body).getByText('Select a Project first'),
      ).toBeVisible()
    })
    await expect(
      within(document.body).getByText('Choose a Project, or add one, to start a Session.'),
    ).toBeVisible()
    await expect(args.onNew).not.toHaveBeenCalled()
  },
}

export const CommandTitledSession: Story = {
  args: {
    roster: {
      ...listed,
      sessions: [{ ...session, title: { text: '/implement 1847', source: 'first-prompt' } }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reference = canvas.getByText('/implement').closest('span.inline-flex')
    await expect(reference?.querySelector('svg')).not.toBeNull()
    await expect(canvas.getByRole('button', { name: /\/implement 1847/ })).toBeVisible()
  },
}

// Optional activity metadata must not present `unknown` status as an activity summary.
export const MissingActivityKeepsStatusOutOfTheSubtitle: Story = {
  args: {
    roster: {
      ...listed,
      sessions: [
        {
          ...session,
          activity: null,
          status: 'unknown',
          title: { text: 'A Session with no observed activity', source: 'first-prompt' },
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const unknown = canvas.getAllByText('Unknown')
    await expect(unknown).toHaveLength(1)
    await expect(unknown[0]).toHaveClass('sr-only')
    await expect(canvas.queryByText('unknown')).toBeNull()
  },
}

export const RosterStructure: Story = {
  args: {
    roster: {
      ...listed,
      sessions: [
        {
          ...session,
          activity: {
            label: 'Watch PR checks',
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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Watch PR checks')).toBeVisible()
    await expect(canvas.queryByText(/Bash RTK_DISABLED=1 gh pr checks 2062/)).toBeNull()
    await expect(canvas.getByText('#2062')).toBeVisible()
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
  args: {
    roster: {
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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const wantsAnswer = canvas.getByRole('button', { name: /A question is waiting/ })
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
  args: {
    roster: {
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
    },
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-44">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByLabelText('Sessions sidebar')
    const name = within(sidebar).getByText(/Keep the Sessions sidebar readable/)
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(sidebar.scrollWidth).toBeLessThanOrEqual(sidebar.clientWidth)
  },
}

// A title that fell back to the opening prompt draws its skill mention as a badge, not the raw
// markdown-link brackets (#2049).
export const SkillMentionTitle: Story = {
  args: {
    roster: {
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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('button', { name: /Implement/ })
    await expect(row).not.toHaveTextContent('[$implement]')
    await expect(row.querySelector('svg')).not.toBeNull()
    await expect(row).toHaveTextContent('https://github.com/milad-alizadeh/argo/issues/1944')
    await expect(row.querySelector('a')).toBeNull()
  },
}

export const RenameSurvivesRosterPoll: Story = {
  render: (args) => <RenameSurvivesPollRoster {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('button', { name: /Read the Session transcript/ })
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
    window.dispatchEvent(new Event('story:repoll'))
    await expect(
      canvas.getByRole('button', { name: /Keep the rename after a poll/ }),
    ).toBeInTheDocument()
  },
}

export const FocusRecovery: Story = {
  render: (args) => <FocusRecoveryRoster {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const removed = canvas.getByRole('button', { name: /A second Session/ })
    removed.focus()
    await expect(removed).toHaveFocus()
    window.dispatchEvent(new Event('story:remove-focused-session'))
    const survivor = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await waitFor(async () => {
      await expect(survivor).toHaveFocus()
      await expect(survivor).toHaveAttribute('tabindex', '0')
    })
  },
}

export const Loading: Story = {
  args: { roster: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Reading Sessions' })).toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6)
  },
}
export const Empty: Story = {
  args: { roster: { ...listed, sessions: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Sessions found')).toBeInTheDocument()
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
}) {
  return {
    version: 1,
    type: 'session.archive.listed',
    requestId: 'storybook-archive',
    sessions: [],
    nextCursor: null,
    restored: null,
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
    const row = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await userEvent.pointer({ keys: '[MouseRight]', target: row })
    const archive = await within(document.body).findByRole('menuitem', { name: 'Archive' })
    await userEvent.click(archive)
    await expect(args.onArchiveSelected).toHaveBeenCalledWith(['prose'])
  },
}

export const Failure: Story = {
  args: { roster: null, rosterError: readFailure },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const alert = canvas.getByRole('alert')
    await expect(alert).toHaveAttribute('data-slot', 'alert')
    await expect(alert).toHaveTextContent('Unable to load Sessions')
    await expect(alert).toHaveTextContent('Argo could not read these Sessions.')
  },
}

// The roster's window grows when the reader reaches the bottom of what is loaded, and at no other
// time. The sentinel row is what "reached" means, and it is mounted well before it is visible: the
// virtualizer keeps 30 rows of overscan, so a sentinel below the fold used to count as reached and
// the roster grew a page before the reader had scrolled at all (#2277).
const manySessions = {
  ...listed,
  sessions: Array.from({ length: 40 }, (_, index) => ({
    ...session,
    id: `session-${index}`,
    title: { text: `Session number ${index}`, source: 'first-prompt' as const },
  })),
  nextCursor: 'page-2',
} satisfies SessionsListed

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
  beforeEach: showingActiveSessions,
  args: { hasMoreSessions: true, onFetchMoreSessions: fn(), roster: manySessions },
  play: async ({ args, canvasElement }) => {
    const scroll = rosterScroll(canvasElement)
    await expect(scroll.scrollTop).toBe(0)
    await expect(args.onFetchMoreSessions).not.toHaveBeenCalled()
    scroll.scrollTop = scroll.scrollHeight
    scroll.dispatchEvent(new Event('scroll'))
    await waitFor(() => expect(args.onFetchMoreSessions).toHaveBeenCalled())
    // One arrival of the sentinel asks for one page: the callback's identity changes with the cursor
    // the read returned, which used to ask again for as long as the sentinel stayed in view.
    await expect(args.onFetchMoreSessions).toHaveBeenCalledTimes(1)
  },
}

// A window shorter than the viewport leaves the sentinel visible with nothing to scroll, so it is
// reached once and asks once, rather than growing the roster page after page on its own.
export const AsksOnceWhenTheWindowDoesNotFillTheViewport: Story = {
  beforeEach: showingActiveSessions,
  args: {
    hasMoreSessions: true,
    onFetchMoreSessions: fn(),
    roster: { ...listed, nextCursor: 'page-2' },
  },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onFetchMoreSessions).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(args.onFetchMoreSessions).toHaveBeenCalledTimes(1)
  },
}

// The spinner stands where the rows it waits for will be: one Session row tall, at the bottom of the
// list, with the spinner centered in it and no border of its own.
export const GrowingTheWindow: Story = {
  beforeEach: showingActiveSessions,
  args: { hasMoreSessions: true, isFetchingMoreSessions: true, roster: manySessions },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const spinner = canvas.getByRole('status', { name: 'Loading more Sessions' })
    await expect(spinner).toBeVisible()
    await expect(spinner.getBoundingClientRect().height).toBe(56)
    const rows = [...canvas.getByRole('navigation', { name: 'Sessions' }).querySelectorAll('li')]
    await expect(rows.indexOf(spinner.closest('li') as HTMLLIElement)).toBe(rows.length - 1)
  },
}
