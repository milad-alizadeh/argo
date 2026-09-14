import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionsSidebar } from '../components/SessionsSidebar'
import { sessionRosterRow } from '../session-fixtures'
import { SessionScreenView } from './SessionScreenView'

// #2111: the Feed read that never answers. The main process reads an `external` Session's
// transcript in a loop that only ends when two consecutive reads see the file unchanged
// (`stableChain`, core/sessions/feed-cache.ts), so a transcript a real terminal is still writing
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

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

function stalledFeedHost() {
  const before = window.argo
  const selectedBefore = window.localStorage.getItem(SELECTED_SESSION_KEY)
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
    }),
    readSessionFeed: () => new Promise(() => {}),
  }
  // The chosen Session is read back on the next mount, so this story puts it back as it found it
  // rather than steering a later story's first navigation.
  return () => {
    window.argo = before
    if (selectedBefore === null) window.localStorage.removeItem(SELECTED_SESSION_KEY)
    else window.localStorage.setItem(SELECTED_SESSION_KEY, selectedBefore)
  }
}

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen/FeedStall',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${stalled.id}`]}>
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
    // answer here instead of the row itself.
    const row = rowFor(canvasElement, other.id)
    const box = row.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    await expect(row.contains(hit)).toBe(true)

    // And the click the report says is swallowed still reaches the row's own handler, which
    // writes the chosen Session before it navigates (SessionsSidebarContainer.tsx).
    window.localStorage.removeItem(SELECTED_SESSION_KEY)
    await userEvent.click(canvas.getByText('Another Session to switch to'))
    await waitFor(() =>
      expect(window.localStorage.getItem(SELECTED_SESSION_KEY)).toBe(other.id),
    )

    // Still spinning: nothing in the Feed's own loading state bounds it.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await expect(canvasElement.querySelector('[data-state="loading"]')).not.toBeNull()
  },
}
