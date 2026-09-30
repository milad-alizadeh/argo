import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { type FeedRead, installSessionHost } from '@/mocks/sessions/session-story-host'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { SessionList } from '../session-list/session-list'
import { SessionScreenView } from './session-screen-view'

const session = sessionRow({
  id: 'flaky-feed-session',
  posture: null,
  title: { text: 'Read the transcript through a flaky source', source: 'first-prompt' },
  name: 'Read the transcript through a flaky source',
  status: 'idle',
  cwd: '/storybook/argo',
})

let flakyFeedReads = 0

// A live process holding a Session elsewhere can fail one vendor history read; the Session already
// read stays on screen through that (#2053).
function flakyFeedHost() {
  flakyFeedReads = 0
  const read: FeedRead = async () => {
    flakyFeedReads += 1
    if (flakyFeedReads === 2) throw new Error('Vendor history is unavailable.')
    return [{ kind: 'message', id: 'flaky-row', role: 'assistant', text: 'Read before the flake.' }]
  }
  return installSessionHost([session], { feed: read })
}

// The first read can fail before any history has reached the Feed (#2071).
function flakyFirstOpenHost() {
  let reads = 0
  const read: FeedRead = async () => {
    reads += 1
    if (reads === 1) throw new Error('Vendor history is unavailable.')
    return [{ kind: 'message', id: 'flaky-row', role: 'assistant', text: 'Read after the flake.' }]
  }
  return installSessionHost([session], { feed: read })
}

let historyReady = false

function missingHistoryHost(listed = true) {
  historyReady = false
  const read: FeedRead = async () => {
    if (!historyReady)
      throw Object.assign(new Error('Session is missing.'), { data: { code: 'NOT_FOUND' } })
    return [{ kind: 'message', id: 'recovered-row', role: 'assistant', text: 'History recovered.' }]
  }
  return installSessionHost(listed ? [session] : [], { feed: read })
}

const liveIdentity = { sessionId: session.id, commandId: null, turnId: null } as const

// Main joins the read history with live work that history does not hold yet, in one reading.
function liveFeedHost() {
  const read: FeedRead = async () => [
    { kind: 'message', id: 'history-row', role: 'user', text: 'Check the build.' },
  ]
  return installSessionHost([session], {
    feed: read,
    live: [
      { ...liveIdentity, sequence: 1, type: 'status', vendorEventId: null, status: 'running' },
      {
        ...liveIdentity,
        sequence: 2,
        type: 'content',
        vendorEventId: 'live-row',
        content: {
          kind: 'message',
          id: 'live-row',
          role: 'assistant',
          text: 'The build is still running.',
        },
      },
    ],
  })
}

const meta = {
  title: 'Sessions/Screen/Feed Resilience',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${session.id}`]}>
          <AppShell leftHeader={<ProjectSwitcher />} sidebar={<SessionList />}>
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

export const SurvivesOneFailedRefresh: Story = {
  beforeEach: () => flakyFeedHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const visible = () => canvas.getAllByText('Read before the flake.')
    await waitFor(() => expect(visible()).toHaveLength(1))
    await trpcClient.sessionFeedRefresh.mutate({ sessionId: session.id })
    await waitFor(() => expect(flakyFeedReads).toBeGreaterThanOrEqual(2))
    await expect(visible()).toHaveLength(1)
    await waitFor(() => expect(canvas.getByText('Session history is unavailable.')).toBeVisible())
  },
}

export const FirstReadFailureCanRetry: Story = {
  beforeEach: () => flakyFirstOpenHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Session history is unavailable.')).toBeVisible())
    const feedFailure = canvas
      .getByText('Session history is unavailable.')
      .closest('[role="alert"]')
    if (!(feedFailure instanceof HTMLElement))
      throw new Error('The Session history failure alert is missing.')
    await within(feedFailure).getByRole('button', { name: 'Retry' }).click()
    const visible = () =>
      canvas
        .getAllByText('Read after the flake.')
        .filter((node) => node.closest('[aria-hidden]') === null)
    await waitFor(() => expect(visible()).toHaveLength(1))
    await expect(canvas.queryByText('Session history is unavailable.')).toBeNull()
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

export const LiveWorkFollowsHistory: Story = {
  beforeEach: () => liveFeedHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const drawn = (text: string) =>
      canvas.getAllByText(text).filter((node) => node.closest('[aria-hidden]') === null)
    await waitFor(() => expect(drawn('The build is still running.')).toHaveLength(1))
    const [live] = drawn('The build is still running.')
    const [history] = drawn('Check the build.')
    if (live === undefined || history === undefined) throw new Error('A Feed row is missing.')
    await expect(live).toBeVisible()
    await expect(
      history.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  },
}
