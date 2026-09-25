import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import { sessionRosterRow } from '../session-fixtures'
import { SessionsSidebar } from '../session-list/sidebar/sessions-sidebar'
import type { SessionFeed } from '../types'
import { SessionScreenView } from './session-screen-view'

const SESSION_ID = 'feed-actions-session'
const SUBAGENT_ID = 'child-task-2669'
const SKILL_PATH = '/storybook/.agents/skills/to-spec/SKILL.md'
const SUBAGENT_NAME = 'Explore turn setup and harness code for issue 2669'
let readSubagentIds: Array<string | null> = []
const session = sessionRosterRow({
  id: SESSION_ID,
  posture: 'external',
  title: { text: 'Feed actions', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})

function feed(sessionId: string, subagentId: string | null): SessionFeed {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: `feed-${subagentId ?? 'parent'}`,
    sessionId,
    chainId: sessionId,
    revision: `feed-${subagentId ?? 'parent'}-one`,
    rows:
      subagentId === null
        ? [
            {
              shape: 'event',
              id: 'skill-invocation',
              event: 'skill-invocation',
              text: '/to-spec https://github.com/milad-alizadeh/argo/issues/2669',
              skill: { name: 'to-spec', path: SKILL_PATH },
            },
            {
              shape: 'subagent',
              id: 'subagent-started',
              event: 'started',
              subagentId: SUBAGENT_ID,
              name: SUBAGENT_NAME,
            },
          ]
        : [
            {
              shape: 'prose',
              id: 'child-transcript',
              role: 'assistant',
              text: 'Child transcript loaded from the selected Subagent.',
            },
          ],
  }
}

const meta = {
  title: 'Sessions/Screen/Feed Actions',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[`/sessions/${SESSION_ID}`]}>
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

function withFeedActions() {
  return () => {
    readSubagentIds = []
    const previous = window.argo
    window.argo = {
      ...previous,
      listSessions: async () => ({
        version: 1,
        type: 'session.listed',
        requestId: 'feed-actions-sessions',
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
        readSubagentIds.push(request.subagentId)
        return feed(request.sessionId, request.subagentId)
      },
      readSkillFile: async (request) => ({
        version: 1,
        type: 'session.skill.read',
        requestId: 'feed-actions-skill',
        content:
          request.path === SKILL_PATH
            ? '---\nname: to-spec\ndescription: Inspect an issue.\n---\n\n# To spec\n\nCheck the **acceptance criteria**.'
            : null,
      }),
    }
    return () => {
      window.argo = previous
    }
  }
}

export const SkillInvocationExpandsInTheSessionFeed: Story = {
  beforeEach: withFeedActions(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const skill = await canvas.findByRole('button', { name: /Skill invoked \/to-spec/ })
    await expect(skill).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(skill)
    await expect(skill).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'To spec' })).toBeVisible())
    await expect(canvas.getByText('acceptance criteria').tagName).toBe('STRONG')
  },
}

export const FeedSubagentOpensItsInspector: Story = {
  beforeEach: withFeedActions(),
  render: () => <SessionScreenView />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const subagent = await canvas.findByRole('button', { name: `${SUBAGENT_NAME} started` })
    await userEvent.click(subagent)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Session inspector' })).toBeVisible(),
    )
    await waitFor(() => expect(readSubagentIds).toContain(SUBAGENT_ID))
    await expect(canvas.getByText(SUBAGENT_NAME)).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByLabelText('Subagent history')).toHaveAttribute(
        'data-reading-revision',
        `feed-${SUBAGENT_ID}-one`,
      ),
    )
    await expect(
      await canvas.findByText('Child transcript loaded from the selected Subagent.'),
    ).toBeVisible()
  },
}
