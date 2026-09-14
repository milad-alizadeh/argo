import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { sessionRosterRow } from '../session-fixtures'
import { useComposerStore } from '../state/useComposerStore'
import type { SessionFeed } from '../types'
import { SessionScreenView } from './SessionScreenView'

const SESSION_ID = 'new-managed-session'
const PROMPT = 'Keep the first answer responsive.'
const session = sessionRosterRow({
  id: SESSION_ID,
  posture: 'managed',
  title: { text: PROMPT, source: 'first-prompt' },
  status: 'running',
  cwd: '/storybook/argo',
})

function RouteReading() {
  const location = useLocation()
  return (
    <output aria-label="Session route" className="sr-only">
      {location.pathname}
    </output>
  )
}

type StartState = {
  feedEventReady: boolean
  feedReads: number
  projectOpened: boolean
  prompts: string[]
}

function projectClient(state: StartState) {
  return {
    listProjects: async () => ({
      version: 1 as const,
      type: 'project.listed' as const,
      requestId: 'start-session-projects',
      projects: [{ id: 'storybook-project', name: 'argo', path: '/storybook/argo' }],
      selectedId: 'storybook-project',
    }),
    openProject: async () => {
      state.projectOpened = true
      return {
        version: 1 as const,
        type: 'project.opened' as const,
        requestId: 'start-session-project',
        project: { id: 'storybook-project', name: 'argo' },
      }
    },
  }
}

function sessionClient(state: StartState) {
  return {
    listSessions: async () => ({
      version: 1 as const,
      type: 'session.listed' as const,
      requestId: 'start-session-list',
      sessions:
        state.prompts.length === 0
          ? []
          : [
              {
                ...session,
                // The CLI records the turn once it reads the first event (#2099): the Marker
                // settles by noticing this move, not by a new signal of its own.
                turnStartedAt: state.feedEventReady ? '2026-09-14T00:00:00Z' : null,
              },
            ],
      filesFound: state.prompts.length,
      filesRead: state.prompts.length,
      filesUnreadable: 0,
    }),
    startSession: async ({ prompt }: Parameters<typeof window.argo.startSession>[0]) => {
      state.prompts.push(prompt)
      return {
        version: 1 as const,
        type: 'session.started' as const,
        requestId: 'start-session',
        sessionId: SESSION_ID,
      }
    },
    readSessionFeed: async () => {
      state.feedReads += 1
      return {
        version: 1 as const,
        type: 'session.feed.read' as const,
        requestId: 'start-session-feed',
        sessionId: SESSION_ID,
        chainId: SESSION_ID,
        revision: state.feedEventReady ? 'first-event' : 'before-first-event',
        rows: state.feedEventReady
          ? [{ shape: 'prose' as const, id: 'first-event', role: 'user' as const, text: PROMPT }]
          : [],
      } satisfies SessionFeed
    },
  }
}

function startHost() {
  const state: StartState = {
    feedEventReady: false,
    feedReads: 0,
    projectOpened: false,
    prompts: [],
  }
  return {
    state,
    beforeEach: () => {
      state.feedEventReady = false
      state.feedReads = 0
      state.projectOpened = false
      state.prompts = []
      const previous = window.argo
      window.argo = {
        ...previous,
        ...projectClient(state),
        ...sessionClient(state),
      }
      return () => {
        window.argo = previous
      }
    },
  }
}

const returnHost = startHost()
const clickHost = startHost()

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen/Start',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={['/sessions/new']}>
          <Routes>
            <Route
              path="/sessions/:sessionId"
              element={
                <>
                  <Story />
                  <RouteReading />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function writePrompt(
  canvasElement: HTMLElement,
  state: ReturnType<typeof startHost>['state'],
) {
  const canvas = within(canvasElement)
  await waitFor(() => expect(state.projectOpened).toBe(true))
  const composer = await canvas.findByLabelText('Message')
  await userEvent.click(composer)
  await userEvent.type(composer, PROMPT)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled())
  return { canvas, composer }
}

async function expectStartedOnce(canvasElement: HTMLElement, prompts: string[]) {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByLabelText('Session route')).toHaveTextContent(SESSION_ID))
  await expect(prompts).toEqual([PROMPT])
  await waitFor(() => expect(canvas.getByLabelText('Message')).toHaveFocus())
}

export const ReturnStartsOnceAndShowsRunningUntilTheFirstEvent: Story = {
  beforeEach: returnHost.beforeEach,
  play: async ({ canvasElement }) => {
    const { canvas } = await writePrompt(canvasElement, returnHost.state)
    await userEvent.keyboard('{Enter}')
    await expectStartedOnce(canvasElement, returnHost.state.prompts)

    await waitFor(() => expect(returnHost.state.feedReads).toBeGreaterThan(0))
    await waitFor(() =>
      expect(
        canvasElement.querySelector('.feed__document[data-active="true"]'),
      ).toBeInTheDocument(),
    )
    await expect(canvas.getByRole('status', { name: 'Starting Session' })).toBeVisible()
    for (let frame = 0; frame < 5; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    }
    await expect(canvas.getByRole('status', { name: 'Starting Session' })).toBeVisible()
    await expect(canvas.queryByText('No messages')).toBeNull()

    returnHost.state.feedEventReady = true
    await waitFor(() =>
      expect(canvas.getByLabelText('Session history')).toHaveAttribute(
        'data-reading-revision',
        'first-event:',
      ),
    )
    await expect(canvas.getByLabelText('Session history')).toHaveTextContent(PROMPT)
    await waitFor(() =>
      expect(canvas.queryByRole('status', { name: 'Starting Session' })).toBeNull(),
    )
  },
}

export const ClickingSendKeepsFocus: Story = {
  beforeEach: clickHost.beforeEach,
  play: async ({ canvasElement }) => {
    const { canvas } = await writePrompt(canvasElement, clickHost.state)
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expectStartedOnce(canvasElement, clickHost.state.prompts)
  },
}
