import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { sessionFeedTrpc, sessionListTrpc, sessionRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

const session = sessionRow({
  id: 'flaky-feed-session',
  posture: 'external',
  title: { text: 'Read the transcript through a flaky poll', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// A live process holding a Session elsewhere can fail one vendor history read; the Session already
// read stays on screen through that (#2053).
function flakyFeedHost() {
  let reads = 0
  const before = window.argo
  window.argo = {
    ...before,
    trpc: sessionFeedTrpc(
      sessionListTrpc(before.trpc, () => [session]),
      async (sessionId) => {
        reads += 1
        if (reads === 2) throw new Error('Vendor history is unavailable.')
        return {
          version: 1,
          type: 'session.feed.read',
          requestId: 'storybook-feed',
          sessionId,
          chainId: sessionId,
          revision: `storybook-feed-${reads}`,
          rows: [
            { shape: 'prose', id: 'flaky-row', role: 'assistant', text: 'Read before the flake.' },
          ],
        }
      },
    ),
  }
  return () => {
    window.argo = before
  }
}

// The same tolerance must cover a Session's first-ever open, with no cached feed yet: an
// actively driven Session races its writer on every poll, including the first (#2071).
function flakyFirstOpenHost() {
  let reads = 0
  const before = window.argo
  window.argo = {
    ...before,
    trpc: sessionFeedTrpc(
      sessionListTrpc(before.trpc, () => [session]),
      async (sessionId) => {
        reads += 1
        if (reads === 1) throw new Error('Vendor history is unavailable.')
        return {
          version: 1,
          type: 'session.feed.read',
          requestId: 'storybook-feed',
          sessionId,
          chainId: sessionId,
          revision: `storybook-feed-${reads}`,
          rows: [
            { shape: 'prose', id: 'flaky-row', role: 'assistant', text: 'Read after the flake.' },
          ],
        }
      },
    ),
  }
  return () => {
    window.argo = before
  }
}

let historyReady = false

function missingHistoryHost(listed = true) {
  historyReady = false
  const before = window.argo
  window.argo = {
    ...before,
    trpc: sessionFeedTrpc(
      sessionListTrpc(before.trpc, () => (listed ? [session] : [])),
      async (sessionId) => {
        if (!historyReady)
          throw Object.assign(new Error('Session is missing.'), { data: { code: 'NOT_FOUND' } })
        return {
          version: 1,
          type: 'session.feed.read',
          requestId: 'storybook-feed',
          sessionId,
          chainId: sessionId,
          revision: 'recovered',
          rows: [
            {
              shape: 'prose',
              id: 'recovered-row',
              role: 'assistant',
              text: 'History recovered.',
            },
          ],
        }
      },
    ),
  }
  return () => {
    window.argo = before
  }
}

const meta = {
  title: 'Sessions/Screen/Feed Resilience',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${session.id}`]}>
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

export const SurvivesATransientPoll: Story = {
  beforeEach: () => flakyFeedHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const visible = () => canvas.getAllByText('Read before the flake.')
    await waitFor(() => expect(visible()).toHaveLength(1))

    // The next poll (500ms, session-queries.ts SESSION_REFRESH_MS) fails once; the transcript
    // already on screen must not be replaced by "Unable to load Session".
    await new Promise((resolve) => setTimeout(resolve, 700))
    await expect(visible()).toHaveLength(1)
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const SurvivesATransientPollOnFirstOpen: Story = {
  beforeEach: () => flakyFirstOpenHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The very first feed read fails before any data has ever landed for this Session; the
    // one-miss grace must still hold, so no error screen appears while that plays out.
    await expect(canvas.queryByRole('alert')).toBeNull()

    const visible = () =>
      canvas
        .getAllByText('Read after the flake.')
        .filter((node) => node.closest('[aria-hidden]') === null)
    await waitFor(() => expect(visible()).toHaveLength(1))
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const MissingHistoryCanBeRecovered: Story = {
  beforeEach: () => missingHistoryHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText(/Session history is unavailable/)).toBeVisible(), {
      timeout: 5000,
    })
    const unavailable = canvas.getByText(/Session history is unavailable/)
    await expect(unavailable.parentElement?.textContent).toContain(
      "Argo cannot open this Session's history. Retry, or archive it from the Session list menu",
    )
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.queryByText('Argo cannot find this Session.')).toBeNull()
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    historyReady = true
    await canvas.getByRole('button', { name: 'Retry' }).click()
    await waitFor(() => expect(canvas.getByText('History recovered.')).toBeVisible())
    await expect(canvas.queryByText(/Session history is unavailable/)).toBeNull()
  },
}

export const UnknownSessionHasTruthfulRecovery: Story = {
  beforeEach: () => missingHistoryHost(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText(/Session history is unavailable/)).toBeVisible(), {
      timeout: 5000,
    })
    const unavailable = canvas.getByText(/Session history is unavailable/)
    await expect(unavailable.parentElement?.textContent).toContain(
      'archive it from the Session list menu if it appears there',
    )
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}
