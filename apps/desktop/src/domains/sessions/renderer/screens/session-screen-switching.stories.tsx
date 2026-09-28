import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { cockpitRoutes } from '@/renderer/cockpit-router'
import {
  savedSelectionDraft,
  sessionSelectionHost,
} from '../../../../../test-fixtures/sessions/session-selection-host.fixture'
import { sessionRow } from '../session-fixtures'
import type { Session } from '../types'

const ROSTER = [
  sessionRow({
    id: 'claude-first',
    posture: 'live',
    status: 'idle',
    cwd: '/workspace/argo',
    title: { text: 'First Claude Session', source: 'custom' },
    updatedAt: '2026-09-13T15:50:00Z',
  }),
  sessionRow({
    id: 'codex-second',
    harness: 'codex',
    posture: 'live',
    status: 'idle',
    cwd: '/workspace/argo',
    title: { text: 'Second Codex Session', source: 'custom' },
    updatedAt: '2026-09-13T15:40:00Z',
  }),
  sessionRow({
    id: 'claude-third',
    posture: 'live',
    status: 'idle',
    cwd: '/workspace/argo',
    title: { text: 'Third Claude Session', source: 'custom' },
    updatedAt: '2026-09-13T15:30:00Z',
  }),
] satisfies Session[]

const CARD_LABEL = 'Message composer'
const MESSAGE_LABEL = 'Message'

function CockpitSessionScreen() {
  const [router] = useState(() =>
    createMemoryRouter(cockpitRoutes, {
      initialEntries: ['/projects/project-1/sessions/claude-first'],
    }),
  )
  return (
    <div className="h-dvh w-full">
      <RouterProvider router={router} />
    </div>
  )
}

// Reads the composer after every DOM change, so a change that drops, disables or remounts part of
// it is caught even when the next change puts it back. A disabled card is also the dimmed one.
function watchComposer(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const cards = () => canvas.queryAllByLabelText(CARD_LABEL)
  const editors = () => canvas.queryAllByRole('combobox', { name: MESSAGE_LABEL })
  const [first] = cards()
  let fewestCards = cards().length
  let disabled = false
  let waitedForDraft = false
  let seenEditors = new Set(editors())
  const observer = new MutationObserver(() => {
    fewestCards = Math.min(fewestCards, cards().length)
    for (const card of cards()) if (card.closest('form')?.inert === true) waitedForDraft = true
    for (const editor of editors()) {
      if (editor.getAttribute('aria-disabled') === 'true') disabled = true
      seenEditors.add(editor)
    }
  })
  observer.observe(canvasElement, {
    attributes: true,
    attributeFilter: ['aria-disabled', 'inert'],
    childList: true,
    subtree: true,
  })
  return {
    // Editors mounted since the last read, beyond the one already on screen then.
    read: () => {
      const reading = {
        sameCard: first?.isConnected === true && cards()[0] === first,
        fewestCards,
        disabled,
        waitedForDraft,
        editorsMounted: seenEditors.size - 1,
      }
      seenEditors = new Set(editors())
      waitedForDraft = false
      return reading
    },
    stop: () => observer.disconnect(),
  }
}

async function switchTo(
  canvasElement: HTMLElement,
  watch: ReturnType<typeof watchComposer>,
  input: { title: string; sessionId: string; harness: string; draft: string; revisit: boolean },
) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: new RegExp(input.title) }))
  await waitFor(() =>
    expect(canvas.getByLabelText('Session history')).toHaveAttribute(
      'data-session',
      input.sessionId,
    ),
  )
  await waitFor(() => {
    expect(canvas.getByRole('combobox', { name: MESSAGE_LABEL })).toHaveTextContent(input.draft)
    expect(
      canvas
        .getByRole('button', { name: /^Choose Turn configuration:/ })
        .getAttribute('aria-label'),
    ).toMatch(new RegExp(`^Choose Turn configuration: ${input.harness},`))
  })
  await expect(watch.read()).toEqual({
    sameCard: true,
    fewestCards: 1,
    disabled: false,
    // Only a first visit reads its draft; a revisit starts from the one this renderer holds.
    waitedForDraft: !input.revisit,
    editorsMounted: 1,
  })
}

const meta = {
  title: 'Sessions/Screen/Switching',
  component: CockpitSessionScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CockpitSessionScreen>

export default meta
type Story = StoryObj<typeof meta>

// A Session switch keeps the one composer card on screen, enabled, and swaps only its content,
// for Claude and Codex Sessions alike (#2836).
export const SwitchingKeepsTheComposerCardMounted: Story = {
  beforeEach: () => sessionSelectionHost(ROSTER),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = await canvas.findByRole('combobox', { name: MESSAGE_LABEL })
    await waitFor(() => expect(composer).toHaveAttribute('aria-disabled', 'false'))
    await userEvent.type(composer, 'Draft for the first Session')
    // The draft saves after a pause in typing; the switch comes after that save.
    await waitFor(() =>
      expect(savedSelectionDraft({ type: 'session', sessionId: 'claude-first' })).toMatchObject({
        prompt: 'Draft for the first Session',
      }),
    )
    const watch = watchComposer(canvasElement)
    try {
      await switchTo(canvasElement, watch, {
        title: 'Second Codex Session',
        sessionId: 'codex-second',
        harness: 'Codex',
        revisit: false,
        draft: '',
      })
      await switchTo(canvasElement, watch, {
        title: 'Third Claude Session',
        sessionId: 'claude-third',
        harness: 'Claude Code',
        revisit: false,
        draft: '',
      })
      await switchTo(canvasElement, watch, {
        title: 'Second Codex Session',
        sessionId: 'codex-second',
        harness: 'Codex',
        revisit: true,
        draft: '',
      })
      await switchTo(canvasElement, watch, {
        title: 'First Claude Session',
        sessionId: 'claude-first',
        harness: 'Claude Code',
        revisit: true,
        draft: 'Draft for the first Session',
      })
    } finally {
      watch.stop()
    }
  },
}
