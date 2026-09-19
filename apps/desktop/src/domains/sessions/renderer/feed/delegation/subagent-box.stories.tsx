// The Subagent line in every state: started, messaged, responded per end state, a missing fact,
// and a line with no Subagent transcript to open.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { SubagentBox, type SubagentRow } from './subagent-box'

const STARTED: SubagentRow = {
  shape: 'subagent',
  id: 'review:started',
  subagentId: 'call-review',
  event: 'started',
  name: 'semantic_compound_verify',
  model: 'gpt-5.6-terra',
}

const REPLY = 'Four labels renamed, none of them compound any more'

const RESPONDED: SubagentRow = {
  shape: 'subagent',
  id: 'review:responded',
  subagentId: 'call-review',
  event: 'responded',
  state: 'completed',
  name: 'semantic_compound_verify',
  model: 'gpt-5.6-terra',
  durationMs: 157_000,
  tokens: 18_400,
  text: REPLY,
}

function Stage({ children }: { children: ReactNode }) {
  return <div className="max-w-(--size-session-column) bg-background p-snug">{children}</div>
}

const meta: Meta = { title: 'Sessions/Feed/Subagent Box', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const OPEN = fn()

const box = (row: SubagentRow, onOpen?: () => void) => (
  <Stage>
    <SubagentBox onOpen={onOpen} row={row} />
  </Stage>
)

const line = (canvasElement: HTMLElement, text: string | RegExp) =>
  within(canvasElement).getByText(text)

async function expand(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /^Agent/ }))
}

export const Started: Story = {
  render: () => box(STARTED),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(line(canvasElement, 'Agent "Semantic compound verify" started')).toBeVisible(),
    )
    await expand(canvasElement)
    await waitFor(() => expect(line(canvasElement, 'gpt-5.6-terra')).toBeVisible())
  },
}

// The text the Session sent is never drawn.
export const Messaged: Story = {
  render: () => box({ ...STARTED, event: 'messaged', text: 'A very long message' }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(line(canvasElement, /messaged$/)).toBeVisible())
    await expand(canvasElement)
    await expect(within(canvasElement).queryByText('A very long message')).toBeNull()
  },
}

export const RespondedCompleted: Story = {
  render: () => box(RESPONDED),
  play: async ({ canvasElement }) => {
    await expand(canvasElement)
    await waitFor(() =>
      expect(line(canvasElement, 'Completed · gpt-5.6-terra · 2m 37s · 18k tokens')).toBeVisible(),
    )
    await waitFor(() => expect(line(canvasElement, REPLY)).toBeVisible())
  },
}

export const RespondedFailed: Story = {
  render: () => box({ ...RESPONDED, state: 'failed', text: 'Could not read the locale catalog' }),
  play: async ({ canvasElement }) => {
    await expand(canvasElement)
    await waitFor(() => expect(line(canvasElement, /^Failed/)).toBeVisible())
  },
}

export const RespondedInterrupted: Story = {
  render: () => box({ ...RESPONDED, state: 'interrupted', text: undefined }),
  play: async ({ canvasElement }) => {
    await expand(canvasElement)
    await waitFor(() => expect(line(canvasElement, /^Interrupted/)).toBeVisible())
  },
}

// Codex gives no reply, duration or tokens: nothing stands in for them.
export const MissingFact: Story = {
  render: () =>
    box({
      ...RESPONDED,
      model: undefined,
      durationMs: undefined,
      tokens: undefined,
      text: undefined,
    }),
  play: async ({ canvasElement }) => {
    await expand(canvasElement)
    await waitFor(() => expect(line(canvasElement, 'Completed')).toBeVisible())
    await expect(within(canvasElement).queryByText(/·/)).toBeNull()
  },
}

// With nothing to show and no way in, the line is plain text with no toggle.
export const NotClickable: Story = {
  render: () => box({ ...STARTED, model: undefined }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(line(canvasElement, /started$/)).toBeVisible())
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

export const ClickOpensTheSubagentFeed: Story = {
  render: () => box(RESPONDED, OPEN),
  play: async ({ canvasElement }) => {
    OPEN.mockClear()
    await expand(canvasElement)
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Open the/ }))
    await expect(OPEN).toHaveBeenCalledTimes(1)
  },
}
