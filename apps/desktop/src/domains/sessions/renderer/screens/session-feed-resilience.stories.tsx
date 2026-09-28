import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { trpcClient } from '@/platform/renderer/trpc-client'
import {
  sessionFeedSubscribe,
  sessionFeedTrpc,
  sessionListSubscribe,
  sessionRow,
} from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import type { SessionFeedSnapshot } from '../types'
import { SessionScreenView } from './session-screen-view'

const session = sessionRow({
  id: 'flaky-feed-session',
  posture: 'external',
  title: { text: 'Read the transcript through a flaky source', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

let flakyFeedReads = 0

// A live process holding a Session elsewhere can fail one vendor history read; the Session already
// read stays on screen through that (#2053).
function flakyFeedHost() {
  flakyFeedReads = 0
  const before = window.argo
  const read = async (sessionId: string): Promise<SessionFeedSnapshot> => {
    flakyFeedReads += 1
    if (flakyFeedReads === 2) throw new Error('Vendor history is unavailable.')
    return {
      version: 1,
      type: 'session.feed.read',
      requestId: 'storybook-feed',
      sessionId,
      chainId: sessionId,
      revision: `storybook-feed-${flakyFeedReads}`,
      content: [
        { kind: 'message', id: 'flaky-row', role: 'assistant', text: 'Read before the flake.' },
      ],
    }
  }
  window.argo = {
    ...before,
    trpcSubscribe: sessionFeedSubscribe(
      sessionListSubscribe(before.trpcSubscribe, () => [session]),
      read,
    ),
    trpc: sessionFeedTrpc(before.trpc, read),
  }
  return () => {
    window.argo = before
  }
}

// The first read can fail before any history has reached the Feed (#2071).
function flakyFirstOpenHost() {
  let reads = 0
  const before = window.argo
  const read = async (sessionId: string): Promise<SessionFeedSnapshot> => {
    reads += 1
    if (reads === 1) throw new Error('Vendor history is unavailable.')
    return {
      version: 1,
      type: 'session.feed.read',
      requestId: 'storybook-feed',
      sessionId,
      chainId: sessionId,
      revision: `storybook-feed-${reads}`,
      content: [
        { kind: 'message', id: 'flaky-row', role: 'assistant', text: 'Read after the flake.' },
      ],
    }
  }
  window.argo = {
    ...before,
    trpcSubscribe: sessionFeedSubscribe(
      sessionListSubscribe(before.trpcSubscribe, () => [session]),
      read,
    ),
    trpc: sessionFeedTrpc(before.trpc, read),
  }
  return () => {
    window.argo = before
  }
}

let historyReady = false

function missingHistoryHost(listed = true) {
  historyReady = false
  const before = window.argo
  const read = async (sessionId: string): Promise<SessionFeedSnapshot> => {
    if (!historyReady)
      throw Object.assign(new Error('Session is missing.'), { data: { code: 'NOT_FOUND' } })
    return {
      version: 1,
      type: 'session.feed.read',
      requestId: 'storybook-feed',
      sessionId,
      chainId: sessionId,
      revision: 'recovered',
      content: [
        {
          kind: 'message',
          id: 'recovered-row',
          role: 'assistant',
          text: 'History recovered.',
        },
      ],
    }
  }
  window.argo = {
    ...before,
    trpcSubscribe: sessionFeedSubscribe(
      sessionListSubscribe(before.trpcSubscribe, () => (listed ? [session] : [])),
      read,
    ),
    trpc: sessionFeedTrpc(before.trpc, read),
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
