import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { sessionRosterRow } from '../session-fixtures'
import type { SessionError, SessionsListed } from '../types'
import { SessionsSidebarContent, type SessionsSidebarContentProps } from './SessionsSidebar'

const session = sessionRosterRow({
  id: 'prose',
  posture: 'external',
  title: { text: 'Read the Session transcript', source: 'first-prompt' },
  status: 'idle',
  cwd: '/workspace/argo',
  delegations: [{ id: 'interface-review', label: 'Interface review', landed: false }],
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
    await expect(canvas.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New Session' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Find a Session' })).toBeDisabled()
    const row = canvas.getByRole('button', { name: /Read the Session transcript/ })
    await expect(row).toHaveAccessibleName(/Idle/)
    await expect(row.querySelector('svg')).not.toBeNull()
    await userEvent.click(row)
    await expect(args.onSelect).toHaveBeenCalledWith('prose')
    await expect(row).toHaveAttribute('aria-current', 'page')
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
    await expect(canvas.getByText('/implement').closest('[data-slot="badge"]')).not.toBeNull()
    await expect(canvas.getByRole('button', { name: /\/implement 1847/ })).toBeVisible()
  },
}

export const RosterStructure: Story = {
  args: {
    roster: {
      ...listed,
      sessions: [
        {
          ...session,
          activity: { tool: 'Bash', target: 'RTK_DISABLED=1 gh pr checks 2062 --watch' },
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
    await expect(canvas.getByText(/Bash RTK_DISABLED=1 gh pr checks 2062/)).toBeVisible()
    await expect(canvas.getByText('#2062')).toBeVisible()
    await expect(canvas.getByLabelText('1 of 2 steps completed')).toBeVisible()
    await expect(canvas.getByTitle(/^Running /)).toBeVisible()
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
    await expect(within(wantsPermission).getByText('Permission Approval')).toBeVisible()
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
export const AllArchived: Story = {
  args: {
    roster: {
      ...listed,
      sessions: listed.sessions.map((session) => ({
        ...session,
        archived: true,
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No active Sessions')).toBeInTheDocument()
    const disclosure = canvas.getByRole('button', { name: 'Archived 2' })
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(disclosure)
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByRole('button', { name: /Read the Session transcript/ })).toBeVisible()
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
