import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { type SessionErrorCode, sessionError } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionsSidebar } from '../components/SessionsSidebar'
import { SessionScreenView } from './SessionScreenView'

// ADR-0026 as amended by #1842: a Session Argo held before a restart reads orphaned, keeps its
// composer, and the next Send is what resumes it.
const orphaned: SessionRosterRow = {
  id: 'orphaned-session',
  retiredIds: [],
  cli: 'claude',
  posture: 'orphaned',
  title: { text: 'Fix the flaky roster test', source: 'first-prompt' },
  status: 'idle',
  entry: 'interactive',
  cwd: '/storybook/argo',
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
  contextTokens: null,
  spentTokens: null,
}

// The bridge a restarted Argo answers with: the Roster lists the orphaned Session, and a Send
// either resumes it into a live managed channel or is refused with the reason.
function restartedHost(refusal: SessionErrorCode | null) {
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
    sendClaudeSession: async ({ sessionId }) => {
      if (refusal !== null) return sessionError(refusal, 'storybook-send')
      resumed = true
      return { version: 1, type: 'session.claude.accepted', requestId: 'storybook-send', sessionId }
    },
  }
  return () => {
    window.argo = before
  }
}

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Resume',
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

function refusedStory(code: SessionErrorCode): Story {
  return {
    beforeEach: () => restartedHost(code),
    play: async ({ canvasElement }) => {
      const { canvas, composer } = await sendDraft(canvasElement, 'Carry on with the fix.')

      await waitFor(() =>
        expect(canvas.getByRole('alert')).toHaveTextContent(sessionError(code, null).message),
      )
      await expect(composer).toHaveTextContent('Carry on with the fix.')
      await expect(composer).toHaveFocus()
      await expect(canvas.queryByRole('button', { name: 'Interrupt' })).toBeNull()
    },
  }
}

export const HeldByAnotherWindow = refusedStory('held-elsewhere')
export const NeverStartedByArgo = refusedStory('not-resumable')
export const TranscriptGone = refusedStory('missing-session')
export const ClaudeCodeMissing = refusedStory('cli-unavailable')
export const ClaudeFailsToStart = refusedStory('launch-failed')
