import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { SessionsSidebar } from '@/domains/sessions/renderer/roster/sessions-sidebar'
import { SessionScreenView } from '@/domains/sessions/renderer/screens/session-screen-view'
import { sessionRosterRow } from '@/domains/sessions/renderer/session-fixtures'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'

// #2111: the Feed read that never answers. The main process reads an `external` Session's
// transcript in a loop that only ends when two consecutive reads see the file unchanged
// (`stableChain`, domains/sessions/main/feed-cache.ts), so a transcript a real terminal is still writing
// holds the reply open forever. This fixture is that reply, and the play function reads what the
// window does while it is open.
const stalled = sessionRosterRow({
  id: 'stalled-feed-session',
  posture: 'external',
  title: { text: 'A transcript still being written', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

const other = sessionRosterRow({
  id: 'other-session',
  posture: 'external',
  title: { text: 'Another Session to switch to', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

function stalledFeedHost() {
  const before = window.argo
  window.argo = {
    ...before,
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [stalled, other],
      filesFound: 2,
      filesRead: 2,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
    }),
    readSessionFeed: () => new Promise(() => {}),
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
          <CockpitShell header={<ProjectSwitcher />} sidebar={<SessionsSidebar />}>
            <Routes>
              <Route path="/sessions/:sessionId" element={<Story />} />
            </Routes>
          </CockpitShell>
        </MemoryRouter>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

function rowFor(canvasElement: HTMLElement, sessionId: string) {
  const row = canvasElement.querySelector<HTMLButtonElement>(`[data-session-id="${sessionId}"]`)
  if (row === null) throw new Error(`no Roster row for ${sessionId}`)
  return row
}

// What the reader sees: the spinner never resolves, and nothing else in the window is covered.
export const SpinsForeverAndLeavesTheWindowLive: Story = {
  beforeEach: () => stalledFeedHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-state="loading"]')).not.toBeNull(),
    )

    // Hit testing over a Roster row: an overlay or portal left mounted over the window would
    // answer here instead of the row itself. The Roster read can land after the Feed's spinner.
    const row = await waitFor(() => rowFor(canvasElement, other.id))
    const box = row.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    await expect(row.contains(hit)).toBe(true)

    // And the click the report says is swallowed is delivered to that row: the pointer press
    // reaches it and leaves the focus there, which a cover over the window would prevent.
    await userEvent.click(canvas.getByText('Another Session to switch to'))
    await waitFor(() => expect(document.activeElement).toBe(row))

    // Still spinning: nothing in the Feed's own loading state bounds it.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await expect(canvasElement.querySelector('[data-state="loading"]')).not.toBeNull()
  },
}
