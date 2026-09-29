import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import {
  type FeedRead,
  sessionFeedRefreshTrpc,
  sessionFeedSubscribe,
  sessionListSubscribe,
  sessionRow,
  sessionSubagent,
} from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import { SessionScreenView } from './session-screen-view'

const SESSION_ID = 'subagent-session'
const SUBAGENT_ID = 'a0d1e2f3a4b5c6d7e'
const SUBAGENT_NAME = 'Survey the Harness adapters'
let readSubagentIds: Array<string | null> = []
const session = sessionRow({
  id: SESSION_ID,
  posture: 'external',
  title: { text: 'Subagent history', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
  // The roster the sync stored from the same history.
  subagents: [sessionSubagent({ id: SUBAGENT_ID, label: SUBAGENT_NAME, state: 'completed' })],
})

// The content a Harness adapter reads from history; the screen projects it into rows itself.
const parentContent: FeedContent[] = [
  { kind: 'message', id: 'prompt', role: 'user', text: 'Survey the adapters, then fix the bug.' },
  {
    kind: 'delegation',
    id: 'call-agent',
    event: 'started',
    agentId: SUBAGENT_ID,
    status: 'running',
    name: SUBAGENT_NAME,
    prompt: 'Report each adapter.',
    model: null,
    summary: null,
  },
  {
    kind: 'reference',
    id: 'skill',
    referenceType: 'skill',
    label: 'diagnosing-bugs',
    target: null,
    text: 'The Session keeps showing Running',
  },
  {
    kind: 'delegation',
    id: 'call-agent:response',
    event: 'responded',
    agentId: SUBAGENT_ID,
    status: 'completed',
    name: SUBAGENT_NAME,
    prompt: null,
    model: null,
    summary: 'Each adapter owns one process.',
  },
]
const childContent: FeedContent[] = [
  { kind: 'message', id: 'child-reply', role: 'assistant', text: 'Child transcript loaded.' },
]

const meta = {
  title: 'Sessions/Screen/Subagents',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${SESSION_ID}`]}>
          <AppShell leftHeader={<ProjectSwitcher />} sidebar={<SessionsSidebar />}>
            <Routes>
              <Route path="/sessions/:sessionId" element={<Story />} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </div>
    ),
  ],
  beforeEach: () => {
    readSubagentIds = []
    const previous = window.argo
    const read: FeedRead = async (_sessionId, subagentId) => {
      readSubagentIds.push(subagentId)
      return subagentId === null ? parentContent : childContent
    }
    window.argo = {
      ...previous,
      trpcSubscribe: sessionFeedSubscribe(
        sessionListSubscribe(previous.trpcSubscribe, () => [session]),
        read,
      ),
      trpc: sessionFeedRefreshTrpc(previous.trpc),
    }
    return () => {
      window.argo = previous
    }
  },
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

// History content draws each Subagent event once, a skill row, and the Subagents control.
export const HistoryDrawsSubagentAndSkillRows: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('button', {
        name: `${SUBAGENT_NAME} sent a reply to the main Session`,
      }),
    ).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: `${SUBAGENT_NAME} started` })).toHaveLength(
      1,
    )
    await expect(
      canvas.getAllByRole('button', { name: `${SUBAGENT_NAME} sent a reply to the main Session` }),
    ).toHaveLength(1)
    await expect(canvas.getByText('Skill invoked')).toBeVisible()
    await expect(
      canvas.getByText('diagnosing-bugs The Session keeps showing Running'),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Subagents · 1' })).toBeVisible()
    const sidebarRow = canvasElement.querySelector(
      `nav[aria-label="Sessions"] [data-session-id="${SESSION_ID}"]`,
    )
    if (!(sidebarRow instanceof HTMLElement)) throw new Error('The sidebar Session row is missing.')
    await expect(within(sidebarRow).getByText('1')).toBeVisible()
  },
}

export const SubagentRowOpensItsFeed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', {
        name: `${SUBAGENT_NAME} sent a reply to the main Session`,
      }),
    )
    await waitFor(() => expect(readSubagentIds).toContain(SUBAGENT_ID))
    await waitFor(() => expect(canvas.getByText('Child transcript loaded.')).toBeVisible())
  },
}

export const SubagentsControlOpensItsFeed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Subagents · 1' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: new RegExp(SUBAGENT_NAME) }))
    await waitFor(() => expect(readSubagentIds).toContain(SUBAGENT_ID))
    await waitFor(() => expect(canvas.getByText('Child transcript loaded.')).toBeVisible())
  },
}
