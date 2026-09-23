import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import type { SessionSetup } from '@/domains/sessions/contract/model/models'
import { useComposerStore } from '../composer'
import { sessionRosterRow } from '../session-fixtures'
import { SessionScreenView } from './session-screen-view'

const SESSION_ID = 'managed-turn-setup'
const OPENING_TURN = '2026-09-13T10:00:00.000Z'
const NEXT_TURN = '2026-09-13T10:01:00.000Z'

// A managed Claude Session whose next Turn runs on whatever `reply` says the Harness used.
function managedSession(reply: SessionSetup, sent: unknown[]) {
  const row = sessionRosterRow({
    id: SESSION_ID,
    posture: 'managed',
    title: { text: 'Turn setup Session', source: 'first-prompt' },
    status: 'idle',
    cwd: '/storybook/argo',
    turnStartedAt: OPENING_TURN,
    setup: { model: 'claude-opus-5', effort: 'medium', mode: 'default' },
  })
  return {
    listSessions: () =>
      Promise.resolve({
        version: 1 as const,
        type: 'session.listed' as const,
        requestId: 'turn-setup-sessions',
        sessions: [row],
        filesFound: 1,
        filesRead: 1,
        filesUnreadable: 0,
        filesParsed: 0,
        nextCursor: null,
        historyComplete: true,
        partialFailures: [],
      }),
    sendSession: (request: { sessionId: string }) => {
      sent.push(request)
      Object.assign(row, { turnStartedAt: NEXT_TURN, setup: reply })
      return Promise.resolve({
        version: 1 as const,
        type: 'session.accepted' as const,
        requestId: 'turn-setup-send',
        sessionId: request.sessionId,
      })
    },
  }
}

// Each run starts from the opening Turn, so a replay in the Storybook UI proves the same thing.
function withBridge(reply: SessionSetup) {
  const sent: unknown[] = []
  return {
    sent,
    beforeEach: () => {
      sent.length = 0
      const previous = window.argo
      window.argo = { ...previous, ...managedSession(reply, sent) }
      return () => {
        window.argo = previous
      }
    },
  }
}

const meta = {
  title: 'Sessions/Screen/Turn Setup',
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
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function sendWithMaxEffort(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = await canvas.findByRole('button', { name: /^Choose run setup/ })
  await waitFor(() => expect(trigger).toHaveTextContent('Opus 5·Medium'))
  await userEvent.click(trigger)
  fireEvent.change(await within(document.body).findByRole('slider', { name: 'Effort' }), {
    target: { value: '4' },
  })
  await userEvent.keyboard('{Escape}')
  await expect(trigger).toHaveTextContent('Opus 5·Max')

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
    await expect(trigger).toHaveTextContent('Opus 5·High')
    await expectSameWidthAsComposer(canvasElement)
  },
}

// The message spans exactly the composer card's content column, never wider.
async function expectSameWidthAsComposer(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const alert = canvas.getByRole('alert').getBoundingClientRect()
  const form = canvas.getByLabelText('Message').closest('form')
  if (form === null) throw new Error('The composer has no form.')
  const style = getComputedStyle(form)
  const box = form.getBoundingClientRect()
  await expect(alert.left).toBeCloseTo(box.left + Number.parseFloat(style.paddingLeft))
  await expect(alert.right).toBeCloseTo(box.right - Number.parseFloat(style.paddingRight))
}

const accepted = withBridge({ model: 'claude-opus-5', effort: 'max', mode: 'default' })

export const AcceptedChoiceStays: Story = {
  beforeEach: accepted.beforeEach,
  play: async ({ canvasElement }) => {
    const trigger = await sendWithMaxEffort(canvasElement)
    await waitFor(() => expect(accepted.sent).toHaveLength(1))
    // Two roster polls land the reply the send produced.
    await waitFor(() => expect(trigger).toHaveTextContent('Opus 5·Max'))
    await expect(within(canvasElement).queryByRole('alert')).toBeNull()
  },
}
