import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { SessionError, SessionsListed } from '../types'

import { SessionsSidebarContent, type SessionsSidebarContentProps } from './SessionsSidebar'

const session = {
  id: 'prose',
  retiredIds: [],
  cli: 'claude',
  posture: 'external',
  title: { text: 'Read the Session transcript', source: 'first-prompt' },
  status: 'idle',
  entry: 'interactive',
  cwd: '/workspace/argo',
  branch: 'main',
  updatedAt: null,
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: null,
  activity: null,
  plan: null,
  delegations: [],
  shell: [],
  pullRequest: null,
  archived: false,
} satisfies SessionsListed['sessions'][number]

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

const unavailable = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-roster-unavailable',
  code: 'access-denied',
  message: 'Argo cannot access these Sessions.',
} satisfies SessionError

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
    onReread: fn(),
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
    const row = canvas.getByRole('button', { name: /Read the Session transcript/ })
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
    await userEvent.click(canvas.getByRole('button', { name: 'Read again' }))
    await expect(args.onReread).toHaveBeenCalled()
  },
}

export const Loading: Story = { args: { roster: null } }
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
export const Unavailable: Story = {
  args: { roster: null, rosterError: unavailable },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveAttribute('data-slot', 'alert')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Argo cannot read these Sessions.')
  },
}
export const ReadFailure: Story = {
  args: { roster: null, rosterError: readFailure },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveAttribute('data-slot', 'alert')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Argo cannot read these Sessions.')
  },
}
