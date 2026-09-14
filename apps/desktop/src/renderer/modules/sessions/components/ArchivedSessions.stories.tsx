import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { sessionRosterRow } from '../session-fixtures'
import type { SessionArchiveListed } from '../types'
import { ArchivedSessions } from './ArchivedSessions'
import { SessionRosterList } from './SessionRosterList'

const archivedSession = sessionRosterRow({
  id: 'archived-first-session',
  posture: 'external',
  title: { text: 'Read the archived transcript', source: 'first-prompt' },
  status: 'ended',
  cwd: '/workspace/argo',
  archived: true,
})

function reply(fields: Partial<SessionArchiveListed>): SessionArchiveListed {
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

function withArchiveHost(
  handler: (request: {
    cursor: string | null
    restoreId: string | null
  }) => Promise<SessionArchiveListed>,
) {
  const before = window.argo
  window.argo = { ...before, listArchivedSessions: handler }
  return () => {
    window.argo = before
  }
}

const meta: Meta<typeof ArchivedSessions> = {
  title: 'Sessions/Archive',
  component: ArchivedSessions,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-80 bg-sidebar">
        <Story />
      </div>
    ),
  ],
  args: {
    rows: (sessions, label) => (
      <SessionRosterList
        items={sessions}
        label={label}
        onFocus={fn()}
        onRename={fn()}
        onSelect={fn()}
        renamedTitles={{}}
        selectedSessionId={null}
        tabStop={null}
      />
    ),
    selectedSessionId: null,
    visibleSessionIds: [],
  },
}

export default meta
type Story = StoryObj<typeof ArchivedSessions>

export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const disclosure = canvas.getByText('Archived')
    await expect(disclosure.closest('details')).not.toHaveAttribute('open')
  },
}

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Archived'))
    await waitFor(() => expect(canvas.getByText('No archived Sessions')).toBeInTheDocument())
  },
}

export const Loading: Story = {
  beforeEach: () => withArchiveHost(() => new Promise(() => {})),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Archived'))
    await expect(
      canvas.getByRole('status', { name: 'Reading archived Sessions' }),
    ).toBeInTheDocument()
  },
}

export const Loaded: Story = {
  beforeEach: () => withArchiveHost(async () => reply({ sessions: [archivedSession] })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Archived'))
    await waitFor(async () =>
      expect(
        canvas.getByRole('button', { name: /Read the archived transcript/ }),
      ).toBeInTheDocument(),
    )
  },
}

// Two pages, each holding one Session: opening the section reads the first, and the sentinel row
// reads the second on its own once it enters view, without repeating the first (#1593).
export const LoadsFurtherPagesWithoutDuplicating: Story = {
  beforeEach: () =>
    withArchiveHost(async ({ cursor }) => {
      if (cursor === null) {
        return reply({ sessions: [archivedSession], nextCursor: 'page-2' })
      }
      return reply({ sessions: [{ ...archivedSession, id: 'archived-second-session' }] })
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Archived'))
    await waitFor(async () => {
      const rows = canvas.getAllByRole('button').filter((button) => button.dataset.sessionId)
      await expect(rows).toHaveLength(2)
    })
    await expect(
      canvas.getAllByRole('button').filter((button) => button.dataset.sessionId),
    ).toHaveLength(2)
  },
}

export const Failure: Story = {
  beforeEach: () =>
    withArchiveHost(async () => {
      throw new Error('archive read failed')
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Archived'))
    await waitFor(async () => {
      const alert = canvas.getByRole('alert')
      await expect(alert).toHaveTextContent('Unable to load archived Sessions')
    })
  },
}

// A Session id the sidebar has selected but that never appears in the active Roster can only be
// archived: the section resolves and opens it on its own, without the reader being asked to
// page through every archived row to find it (#1593).
export const Restored: Story = {
  args: { selectedSessionId: 'archived-first-session', visibleSessionIds: [] },
  beforeEach: () =>
    withArchiveHost(async ({ restoreId }) =>
      reply({
        sessions: [],
        restored: restoreId === 'archived-first-session' ? archivedSession : null,
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByText('Archived').closest('details')).toHaveAttribute('open')
    })
  },
}
