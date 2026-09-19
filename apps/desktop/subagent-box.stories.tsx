// The Subagent box in every state: started, messaged, responded per end state, a missing fact,
// and a box with no Subagent transcript to open.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

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

const box = (row: SubagentRow, onOpen?: () => void) => (
  <Stage>
    <SubagentBox onOpen={onOpen} row={row} />
  </Stage>
)

export const Started: Story = {
  render: () => box(STARTED, fn()),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Started')).toBeVisible()
  },
}

// The text the Session sent is never drawn.
export const Messaged: Story = {
  render: () => box({ ...STARTED, event: 'messaged', text: 'A very long message' }, fn()),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Messaged')).toBeVisible()
    await expect(within(canvasElement).queryByText('A very long message')).toBeNull()
  },
}

export const RespondedCompleted: Story = {
  render: () => box(RESPONDED, fn()),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Completed · gpt-5.6-terra · 2m 37s · 18k tokens'),
    ).toBeVisible()
    await expect(within(canvasElement).getByText(REPLY)).toBeVisible()
  },
}

export const RespondedFailed: Story = {
  render: () =>
    box({ ...RESPONDED, state: 'failed', text: 'Could not read the locale catalog' }, fn()),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/^Failed/)).toBeVisible()
  },
}

export const RespondedInterrupted: Story = {
  render: () => box({ ...RESPONDED, state: 'interrupted', text: undefined }, fn()),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/^Interrupted/)).toBeVisible()
  },
}

// Codex gives no reply, duration or tokens: nothing stands in for them.
export const MissingFact: Story = {
  render: () =>
    box(
      { ...RESPONDED, model: undefined, durationMs: undefined, tokens: undefined, text: undefined },
      fn(),
    ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Completed')).toBeVisible()
    await expect(within(canvasElement).queryByText(/·/)).toBeNull()
  },
}

export const ClickOpensTheSubagentFeed: Story = {
  args: { onOpen: fn() },
  render: (args) => box(RESPONDED, args.onOpen),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
  },
}

export const NotClickable: Story = {
  render: () => box(RESPONDED),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}
