import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { announceSessionListChange, sessionListSubscribe, sessionRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

// #2092: a Session Argo held before a restart reads external, keeps its composer, and the next
// Send is what resumes it, regardless of whether Argo started it originally.
const resumable = sessionRow({
  id: 'resumable-session',
  posture: 'external',
  title: { text: 'Fix the flaky roster test', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// The bridge a restarted Argo answers with: the Roster lists the resumable Session, and a Send
// resumes it into a live channel.
function restartedHost(row = resumable) {
  let resumed = false
  const before = window.argo
  window.argo = {
    ...before,
    trpcSubscribe: sessionListSubscribe(before.trpcSubscribe, () => [
      resumed ? { ...row, posture: 'live', status: 'running' } : row,
    ]),
    trpc: (async (request) => {
      if (request.path !== 'sessionSubmit') return before.trpc(request)
      resumed = true
      announceSessionListChange()
      return { id: request.id, result: { data: { sessionId: row.id } } }
    }) as typeof window.argo.trpc,
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
  beforeEach: () => restartedHost(),
  play: async ({ canvasElement }) => {
    const { canvas, composer } = await sendDraft(canvasElement, 'Carry on with the fix.')

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Interrupt' })).toBeVisible())
    await expect(composer.textContent).toBe('')
    await expect(composer).toHaveFocus()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}
