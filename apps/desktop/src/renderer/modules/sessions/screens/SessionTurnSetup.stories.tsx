import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import type { SessionSetup } from '@/core/sessions/models'
import { useComposerStore } from '../state/useComposerStore'
import { SessionScreenView } from './SessionScreenView'

type Bridge = Record<string, unknown>
const host = window as unknown as { argo: Bridge }

const SESSION_ID = 'managed-turn-setup'
const OPENING_TURN = '2026-09-13T10:00:00.000Z'
const NEXT_TURN = '2026-09-13T10:01:00.000Z'

// A managed Claude Session whose next Turn runs on whatever `reply` says the CLI used.
function managedSession(reply: SessionSetup, sent: unknown[]) {
  const row = {
    id: SESSION_ID,
    retiredIds: [],
    cli: 'claude',
    posture: 'managed',
    title: { text: 'Turn setup Session', source: 'first-prompt' },
    status: 'idle',
    entry: 'interactive',
    cwd: '/storybook/argo',
    branch: 'main',
    updatedAt: null,
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: OPENING_TURN,
    activity: null,
    plan: null,
    setup: { model: 'claude-opus-5', effort: 'medium', mode: 'default' } as SessionSetup,
    delegations: [],
    shell: [],
    pullRequest: null,
    archived: false,
  }
  return {
    listSessions: () =>
      Promise.resolve({
        version: 1,
        type: 'session.listed',
        requestId: 'turn-setup-sessions',
        sessions: [row],
        filesFound: 1,
        filesRead: 1,
        filesUnreadable: 0,
      }),
    sendClaudeSession: (request: { sessionId: string }) => {
      sent.push(request)
      Object.assign(row, { turnStartedAt: NEXT_TURN, setup: reply })
      return Promise.resolve({
        version: 1,
        type: 'session.claude.accepted',
        requestId: 'turn-setup-send',
        sessionId: request.sessionId,
      })
    },
  } satisfies Bridge
}

// Each run starts from the opening Turn, so a replay in the Storybook UI proves the same thing.
function withBridge(reply: SessionSetup) {
  const sent: unknown[] = []
  return {
    sent,
    beforeEach: () => {
      sent.length = 0
      const previous = host.argo
      host.argo = { ...previous, ...managedSession(reply, sent) }
      return () => {
        host.argo = previous
      }
    },
  }
}

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen/Turn setup',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
  decorators: [
    (Story, { parameters }) => (
      <div className="h-dvh w-full">
        <MemoryRouter initialEntries={[parameters.route ?? `/sessions/${SESSION_ID}`]}>
          <Routes>
            <Route path="/sessions/:sessionId" element={<Story />} />
          </Routes>
        </MemoryRouter>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function sendWithMaxEffort(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = await canvas.findByRole('button', { name: /^Choose run setup/ })
  await waitFor(() => expect(trigger).toHaveTextContent('Claude Code·Opus 5·Medium'))
  await userEvent.click(trigger)
  fireEvent.change(await within(document.body).findByRole('slider', { name: 'Effort' }), {
    target: { value: '4' },
  })
  await userEvent.keyboard('{Escape}')
  await expect(trigger).toHaveTextContent('Claude Code·Opus 5·Max')

  await userEvent.click(canvas.getByLabelText('Message'))
  await userEvent.type(canvas.getByLabelText('Message'), 'Think hard about the driver.')
  await userEvent.keyboard('{Enter}')
  return trigger
}

const refused = withBridge({ model: 'claude-opus-5', effort: 'high', mode: 'default' })

export const RefusedChoiceReverts: Story = {
  beforeEach: refused.beforeEach,
  play: async ({ canvasElement }) => {
    const trigger = await sendWithMaxEffort(canvasElement)
    await expect(refused.sent.at(-1)).toMatchObject({
      sessionId: SESSION_ID,
      prompt: 'Think hard about the driver.',
      setup: { model: 'opus', effort: 'max', mode: 'manual' },
    })

    await waitFor(
      () =>
        expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
          'Claude used High, not Max.',
        ),
      { timeout: 3000 },
    )
    await expect(trigger).toHaveTextContent('Claude Code·Opus 5·High')
  },
}

const accepted = withBridge({ model: 'claude-opus-5', effort: 'max', mode: 'default' })

export const AcceptedChoiceStays: Story = {
  beforeEach: accepted.beforeEach,
  play: async ({ canvasElement }) => {
    const trigger = await sendWithMaxEffort(canvasElement)
    await waitFor(() => expect(accepted.sent).toHaveLength(1))
    // Two roster polls land the reply the send produced.
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await expect(within(canvasElement).queryByRole('alert')).toBeNull()
    await expect(trigger).toHaveTextContent('Claude Code·Opus 5·Max')
  },
}

export const NewSessionChoosesTheHarness: Story = {
  beforeEach: accepted.beforeEach,
  parameters: { route: '/sessions/new' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The Model and Effort a new composer opens on are whichever the harness last used.
    const trigger = await canvas.findByRole('button', { name: /^Choose run setup: Claude Code,/ })
    await expect(canvas.getByRole('button', { name: /^Choose permission mode/ })).toBeVisible()

    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('tab', { name: 'Codex' }))
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex')
    await expect(canvas.queryByRole('button', { name: /^Choose permission mode/ })).toBeNull()

    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('tab', { name: 'Claude Code' }))
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveAccessibleName(/^Choose run setup: Claude Code,/)
    await expect(canvas.getByRole('button', { name: /^Choose permission mode/ })).toBeVisible()
  },
}
