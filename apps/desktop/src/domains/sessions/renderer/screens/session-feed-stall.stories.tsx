import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { sessionFeedTrpc, sessionListTrpc, sessionRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

// #2111: the Feed read that never answers. This fixture holds the supported vendor read open and
// the play function reads what the window does while it is waiting.
const stalled = sessionRow({
  id: 'stalled-feed-session',
  posture: 'external',
  title: { text: 'A transcript still being written', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

function stalledFeedHost() {
  const before = window.argo
  window.argo = {
    ...before,
    trpc: sessionFeedTrpc(
      sessionListTrpc(before.trpc, () => [stalled]),
      () => new Promise(() => {}),
    ),
  }
  return () => {
    window.argo = before
  }
}

const meta = {
  title: 'Sessions/Screen/Feed Stall',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${stalled.id}`]}>
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

// What the reader sees: the spinner never resolves, and nothing else in the window is covered.
export const SpinsForeverAndLeavesTheWindowLive: Story = {
  beforeEach: () => stalledFeedHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-state="loading"]')).not.toBeNull(),
    )

    // Hit testing over the project switcher: a full-window overlay would answer here instead.
    const projectSwitcher = canvas.getByRole('button', { name: /Current project:/ })
    const box = projectSwitcher.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    await expect(projectSwitcher.contains(hit)).toBe(true)

    // The click reaches the project switcher while the Session remains selected and loading.
    await userEvent.click(projectSwitcher)
    await waitFor(() => expect(document.activeElement).toBe(projectSwitcher))
    await userEvent.keyboard('{Escape}')

    // Still spinning: nothing in the Feed's own loading state bounds it.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await expect(canvasElement.querySelector('[data-state="loading"]')).not.toBeNull()
  },
}
