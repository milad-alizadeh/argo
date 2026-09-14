import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { type DriveSessionErrorCode, driveSessionError } from '@/core/sessions/contract'
import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionsSidebar } from '../components/SessionsSidebar'
import { sessionRosterRow } from '../session-fixtures'
import { SessionScreenView } from './SessionScreenView'

// ADR-0026 as amended by #1842: a Session Argo held before a restart reads orphaned, keeps its
// composer, and the next Send is what resumes it.
const orphaned = sessionRosterRow({
  id: 'orphaned-session',
  posture: 'orphaned',
  title: { text: 'Fix the flaky roster test', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// The bridge a restarted Argo answers with: the Roster lists the orphaned Session, and a Send
// either resumes it into a live managed channel or is refused with the reason.
function restartedHost(refusal: DriveSessionErrorCode | null) {
  let resumed = false
  const before = window.argo
  window.argo = {
    ...before,
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [resumed ? { ...orphaned, posture: 'managed', status: 'running' } : orphaned],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
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

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen/Resume',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${orphaned.id}`]}>
          <CockpitShell sidebar={<SessionsSidebar />}>
            <Routes>
              <Route path="/sessions/:sessionId" element={<Story />} />
            </Routes>
          </CockpitShell>
        </MemoryRouter>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function sendDraft(canvasElement: HTMLElement, draft: string) {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByText('Storybook Session Feed.')).toBeInTheDocument())
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

// Every refusal draws the same alert with a different message, so one code stands for all of them.
const REFUSAL: DriveSessionErrorCode = 'held-elsewhere'

// A Session open in another app cannot take a Turn: the refusal replaces the composer with a
// footer alert rather than sitting above it (#2053).
export const RefusedSend: Story = {
  beforeEach: () => restartedHost(REFUSAL),
  play: async ({ canvasElement }) => {
    const { canvas } = await sendDraft(canvasElement, 'Carry on with the fix.')

    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(
        driveSessionError(REFUSAL, 'claude', null).message,
      ),
    )
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Interrupt' })).toBeNull()
  },
}
