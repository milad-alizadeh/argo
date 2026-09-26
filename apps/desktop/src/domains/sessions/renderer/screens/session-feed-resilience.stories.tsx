import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { sessionError } from '@/domains/sessions/api/session-error'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { sessionRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

const session = sessionRow({
  id: 'flaky-feed-session',
  posture: 'external',
  title: { text: 'Read the transcript through a flaky poll', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

// A live process holding a Session elsewhere keeps writing its transcript, so a poll can land
// mid-write and fail once; the Session already read stays on screen through that (#2053).
function flakyFeedHost() {
  let reads = 0
  const before = window.argo
  window.argo = {
    ...before,
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [session],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
      partialFailures: [],
    }),
    readSessionFeed: async (request) => {
      reads += 1
      if (reads === 2) {
        return {
          version: 1,
          type: 'session.error',
          requestId: 'storybook-feed-error',
          code: 'internal-error',
          message: 'Argo could not read these Sessions.',
        }
      }
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: 'storybook-feed',
        sessionId: request.sessionId,
        chainId: request.sessionId,
        revision: `storybook-feed-${reads}`,
        rows: [
          { shape: 'prose', id: 'flaky-row', role: 'assistant', text: 'Read before the flake.' },
        ],
      }
    },
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
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [session],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
      partialFailures: [],
    }),
    readSessionFeed: async (request) => {
      reads += 1
      if (reads === 1) {
        return {
          version: 1,
          type: 'session.error',
          requestId: 'storybook-feed-error',
          code: 'internal-error',
          message: 'Argo could not read these Sessions.',
        }
      }
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: 'storybook-feed',
        sessionId: request.sessionId,
        chainId: request.sessionId,
        revision: `storybook-feed-${reads}`,
        rows: [
          { shape: 'prose', id: 'flaky-row', role: 'assistant', text: 'Read after the flake.' },
        ],
      }
    },
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
    listSessions: async () => ({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: listed ? [session] : [],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
      partialFailures: [],
    }),
    readSessionFeed: async (request) =>
      historyReady
        ? {
            version: 1,
            type: 'session.feed.read',
            requestId: 'storybook-feed',
            sessionId: request.sessionId,
            chainId: request.sessionId,
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
        : sessionError('missing-session', 'storybook-feed-error'),
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
    await waitFor(() => expect(canvas.getByText('Session history is unavailable')).toBeVisible(), {
      timeout: 5000,
    })
    await expect(canvas.getByText(/Retry, or archive it from the roster menu/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.queryByText('Argo cannot find this Session.')).toBeNull()
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    historyReady = true
    await canvas.getByRole('button', { name: 'Retry' }).click()
    await waitFor(() => expect(canvas.getByText('History recovered.')).toBeVisible())
    await expect(canvas.getByLabelText('Message')).toBeVisible()
  },
}

export const UnknownSessionHasTruthfulRecovery: Story = {
  beforeEach: () => missingHistoryHost(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Session history is unavailable')).toBeVisible(), {
      timeout: 5000,
    })
    await expect(
      canvas.getByText(/archive it from the roster menu if it appears there/),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}
