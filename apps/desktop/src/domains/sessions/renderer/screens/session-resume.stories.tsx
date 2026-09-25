import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { type DriveSessionErrorCode, driveSessionError } from '@/domains/sessions/api/session-error'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { sessionRosterRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

// #2092: a Session Argo held before a restart reads external, keeps its composer, and the next
// Send is what resumes it, regardless of whether Argo started it originally.
const resumable = sessionRosterRow({
  id: 'resumable-session',
  posture: 'external',
  title: { text: 'Fix the flaky roster test', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// The bridge a restarted Argo answers with: the Roster lists the resumable Session, and a Send
// either resumes it into a live managed channel or is refused with the reason.
function restartedHost(refusal: DriveSessionErrorCode | null, row = resumable) {
  let resumed = false
  const before = window.argo
  window.argo = {
    ...before,
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [resumed ? { ...row, posture: 'managed', status: 'running' } : row],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
      partialFailures: [],
    }),
    sendSession: async ({ sessionId }) => {
      if (refusal !== null) return driveSessionError(refusal, 'claude', 'storybook-send')
      resumed = true
      return { version: 1, type: 'session.accepted', requestId: 'storybook-send', sessionId }
    },
  }
  return () => {
    window.argo = before
  }
}

const meta = {
  title: 'Sessions/Screen/Resume',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${resumable.id}`]}>
          <AppShell leftHeader={<ProjectSwitcher />} sidebar={<SessionsSidebar />}>
            <Routes>
              <Route path="/sessions/:sessionId" element={<Story />} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function sendDraft(canvasElement: HTMLElement, draft: string) {
  const canvas = within(canvasElement)
  await waitFor(() =>
    expect(canvas.getAllByText('Storybook Session Feed.').length).toBeGreaterThan(0),
  )
  const composer = canvas.getByLabelText('Message')
  await userEvent.click(composer)
  await userEvent.type(composer, draft)
  await userEvent.keyboard('{Enter}')
  return { canvas, composer }
}

export const ResumesOnSend: Story = {
  beforeEach: () => restartedHost(null),
  play: async ({ canvasElement }) => {
    const { canvas, composer } = await sendDraft(canvasElement, 'Carry on with the fix.')

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Interrupt' })).toBeVisible())
    await expect(composer.textContent).toBe('')
    await expect(composer).toHaveFocus()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

// Every refusal draws the same lock card, whatever Harness or message caused it (#2092 AC #4/#9).
const REFUSAL: DriveSessionErrorCode = 'held-elsewhere'

// A Session open in another app cannot take a Turn: the refusal replaces the composer with a
// lock card rather than sitting above it (#2053, #2092).
export const RefusedSend: Story = {
  beforeEach: () => restartedHost(REFUSAL),
  play: async ({ canvasElement }) => {
    const { canvas } = await sendDraft(canvasElement, 'Carry on with the fix.')

    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent('This session is open in another app'),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Close it there to continue it in Argo.',
    )
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Interrupt' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}

// A Session another process runs live right now (a `claude` in a terminal, a Codex Turn in the
// Codex app) is locked in the Roster, and its composer never shows: no Send is offered to refuse.
const liveElsewhere = sessionRosterRow({ ...resumable, status: 'running', locked: true })

export const LockedWhileLiveElsewhere: Story = {
  beforeEach: () => restartedHost(null, liveElsewhere),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getAllByText('Storybook Session Feed.').length).toBeGreaterThan(0),
    )

    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent('This session is open in another app'),
    )
    await expect(
      canvas.getByText(
        'This session is open in another app. Close it there to continue it in Argo.',
      ),
    ).toBeInTheDocument()
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Retry' })).toBeNull()
  },
}
