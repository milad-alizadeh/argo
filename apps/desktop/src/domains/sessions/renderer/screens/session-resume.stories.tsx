import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { sessionSelectionHost } from '@/mocks/sessions/session-selection-host.fixture'
import { announceSessionFeedChange } from '@/mocks/sessions/session-story-host'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { queryClient } from '@/platform/renderer/trpc-client'
import { SessionList } from '../session-list/session-list'
import { SessionScreenView } from './session-screen-view'

// #2092: a Session Argo held before a restart reads external, keeps its composer, and the next
// Send is what resumes it, regardless of whether Argo started it originally.
const resumable = sessionRow({
  id: 'resumable-session',
  posture: null,
  title: { text: 'Fix the flaky roster test', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// The bridge a restarted Argo answers with: the Roster lists the resumable Session, and a Send
// resumes it into a live channel.
function restartedHost(row = resumable) {
  const live: SessionLiveEvent[] = []
  const host = sessionSelectionHost([row], {
    feed: async () => [
      { kind: 'message', id: 'storybook-row', role: 'assistant', text: 'Storybook Session Feed.' },
    ],
    live,
  })
  const hosted = window.argo
  window.argo = {
    ...hosted,
    trpc: (async (request) => {
      if (request.path !== 'sessionSubmit') return hosted.trpc(request)
      live.push({
        sessionId: row.id,
        sequence: 1,
        type: 'status',
        commandId: null,
        turnId: null,
        vendorEventId: null,
        status: 'running',
      })
      host.change([{ ...row, posture: 'live', status: 'running' }])
      announceSessionFeedChange()
      return { id: request.id, result: { data: { sessionId: row.id } } }
    }) as typeof window.argo.trpc,
  }
  return host
}

const meta = {
  title: 'Sessions/Screen/Resume',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/projects/storybook-project/sessions/${resumable.id}`]}>
            <AppShell leftHeader={<ProjectSwitcher />} sidebar={<SessionList />}>
              <Routes>
                <Route path="/projects/:projectId/sessions/:sessionId" element={<Story />} />
              </Routes>
            </AppShell>
          </MemoryRouter>
        </QueryClientProvider>
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
  beforeEach: () => restartedHost(),
  play: async ({ canvasElement }) => {
    const { canvas, composer } = await sendDraft(canvasElement, 'Carry on with the fix.')

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Interrupt' })).toBeVisible())
    await expect(composer.textContent).toBe('')
    await expect(composer).toHaveFocus()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}
