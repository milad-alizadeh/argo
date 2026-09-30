import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { sessionRow } from '@/mocks/sessions/session-rows'
import {
  savedSelectionDraft,
  sessionSelectionHost,
} from '@/mocks/sessions/session-selection-host.fixture'
import { announceSessionListChange } from '@/mocks/sessions/session-story-host'
import { queryClient } from '@/platform/renderer/trpc-client'
import type { SessionTurnConfiguration } from '../model/models'
import { SessionScreenView } from './session-screen-view'

const SESSION_ID = 'live-turn-configuration'

// A live Claude Session whose next Turn runs on whatever `reply` says the Harness used.
function liveRow() {
  return sessionRow({
    id: SESSION_ID,
    posture: 'live',
    title: { text: 'Turn turnConfiguration Session', source: 'first-prompt' },
    status: 'idle',
    cwd: '/storybook/argo',
    turnConfiguration: { model: 'claude-opus-5', effort: 'medium', mode: 'default' },
  })
}

// Each run starts from the opening Turn, so a replay in the Storybook UI proves the same thing.
function withBridge(reply: SessionTurnConfiguration) {
  const sent: unknown[] = []
  return {
    sent,
    beforeEach: () => {
      sent.length = 0
      const row = liveRow()
      const restoreHost = sessionSelectionHost([row])
      const hosted = window.argo
      window.argo = {
        ...hosted,
        trpc: (async (request) => {
          if (request.path !== 'sessionSubmit') return hosted.trpc(request)
          sent.push(request.input)
          Object.assign(row, { turnConfiguration: reply })
          announceSessionListChange()
          return { id: request.id, result: { data: { sessionId: SESSION_ID } } }
        }) as typeof window.argo.trpc,
      }
      return restoreHost
    },
  }
}

const meta = {
  title: 'Sessions/Screen/Turn Configuration',
  component: SessionScreenView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <div className="h-dvh w-full">
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[
              parameters.route ?? `/projects/storybook-project/sessions/${SESSION_ID}`,
            ]}
          >
            <Routes>
              <Route path="/projects/:projectId/sessions/:sessionId" element={<Story />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionScreenView>

export default meta
type Story = StoryObj<typeof SessionScreenView>

async function sendWithMaxEffort(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = await canvas.findByRole('button', { name: /^Choose Turn configuration/ })
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

// The Send names a saved draft, and the composer keeps the draft's choice: nothing reads the
// Harness's report back into it, so a refused Effort stays chosen and no message appears.
export const RefusedChoiceStays: Story = {
  beforeEach: refused.beforeEach,
  play: async ({ canvasElement }) => {
    const trigger = await sendWithMaxEffort(canvasElement)
    // A Send names its draft, and the draft carries the prompt and the chosen configuration.
    await expect(refused.sent.at(-1)).toMatchObject({
      draftId: `selection-draft-${SESSION_ID}`,
    })
    await expect(savedSelectionDraft({ type: 'session', sessionId: SESSION_ID })).toMatchObject({
      prompt: 'Think hard about the driver.',
      turnConfiguration: { model: 'opus', effort: 'max', mode: 'manual' },
    })

    await expect(trigger).toHaveTextContent('Opus 5·Max')
    await expect(within(canvasElement).queryByRole('alert')).toBeNull()
  },
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
