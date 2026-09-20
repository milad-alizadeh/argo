// How the Feed shows that a Subagent started and, later, that it finished: one card per
// lifecycle state, and a scene where three agents start together and one has already landed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'

import { BackgroundWork } from '@/domains/sessions/renderer/feed/background-work'
import type { AgentThread } from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import { DelegationThread } from '@/domains/sessions/renderer/feed/delegation/delegation-thread'
import { FeedSubagent } from '@/domains/sessions/renderer/feed/feed-subagent'

const RUNNING: AgentThread = {
  id: 'semantic',
  name: 'semantic_compound_verify',
  phase: 'running',
  line: null,
  durationMs: null,
  tokens: null,
  model: null,
}

const SUCCEEDED: AgentThread = {
  ...RUNNING,
  phase: 'succeeded',
  line: 'Four labels renamed, none of them compound any more',
  durationMs: 157_000,
  tokens: 18_400,
}

const FAILED: AgentThread = {
  ...SUCCEEDED,
  id: 'blind',
  name: 'blind_name_review',
  phase: 'failed',
  line: 'Could not read the locale catalog',
  tokens: 2_700,
}

const SCENE: readonly AgentThread[] = [
  { ...RUNNING, id: 'names', name: 'names_control', line: 'Collecting every label in use' },
  {
    ...SUCCEEDED,
    id: 'blind-done',
    name: 'blind_name_review',
    line: 'Nine names read out of context, two unclear',
    tokens: 9_100,
  },
  RUNNING,
]

function Stage({ children }: { children: ReactNode }) {
  return <div className="max-w-(--size-session-column) bg-background p-snug">{children}</div>
}

const meta: Meta = {
  title: 'Sessions/Feed/Delegation',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj

async function readsTheName(canvasElement: HTMLElement, name: string) {
  await waitFor(() => expect(within(canvasElement).getByText(name)).toBeVisible())
}

export const Started: Story = {
  render: () => (
    <Stage>
      <DelegationThread agents={[RUNNING]} onOpen={fn()} />
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    await readsTheName(canvasElement, 'Semantic compound verify')
    await expect(
      within(canvasElement).getByRole('button', {
        name: 'Open the Semantic compound verify Session',
      }),
    ).toBeVisible()
  },
}

// The facts read as one line joined the way the header list joins them.
export const Finished: Story = {
  render: () => (
    <Stage>
      <DelegationThread agents={[SUCCEEDED]} onOpen={fn()} />
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('2m 37s · 18k tokens')).toBeVisible()
  },
}

export const Failed: Story = {
  render: () => (
    <Stage>
      <DelegationThread agents={[FAILED]} onOpen={fn()} />
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    await readsTheName(canvasElement, 'Could not read the locale catalog')
  },
}

export const Scene: Story = {
  render: () => (
    <Stage>
      <DelegationThread agents={SCENE} onOpen={fn()} />
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(3)
  },
}

type Row = Parameters<typeof FeedSubagent>[0]['row']

const RESPONDED_ROW: Row = {
  shape: 'subagent',
  id: 'review:responded',
  subagentId: 'call-review',
  event: 'responded',
  state: 'completed',
  name: 'semantic_compound_verify',
  text: 'Four labels renamed, none of them compound any more',
  durationMs: 157_000,
  tokens: 18_400,
}

// A Feed row as the Session draws it, with or without a Subagent transcript to open.
function FeedRow({ row, openable = true }: { row: Row; openable?: boolean }) {
  const links = {
    find: () => (openable ? ({ kind: 'delegation' } as never) : null),
    open: fn(),
  }
  return (
    <Stage>
      <BackgroundWork.Provider value={links as never}>
        <FeedSubagent row={row} />
      </BackgroundWork.Provider>
    </Stage>
  )
}

// The text the Session sent is never drawn, and the Subagent still reads as running.
export const Messaged: Story = {
  render: () => (
    <FeedRow
      row={{ ...RESPONDED_ROW, event: 'messaged', state: undefined, text: 'A long message' }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('A long message')).toBeNull()
    await readsTheName(canvasElement, 'Semantic compound verify')
  },
}

export const Interrupted: Story = {
  render: () => <FeedRow row={{ ...RESPONDED_ROW, state: 'interrupted', text: undefined }} />,
  play: async ({ canvasElement }) => {
    await readsTheName(canvasElement, 'Semantic compound verify')
    await expect(within(canvasElement).getByText('Interrupted')).toBeVisible()
  },
}

// Codex gives no reply, duration or tokens: nothing stands in for them.
export const MissingFact: Story = {
  render: () => (
    <FeedRow
      row={{ ...RESPONDED_ROW, text: undefined, durationMs: undefined, tokens: undefined }}
    />
  ),
  play: async ({ canvasElement }) => {
    await readsTheName(canvasElement, 'Semantic compound verify')
    await expect(within(canvasElement).queryByText(/·/)).toBeNull()
  },
}

export const NotClickable: Story = {
  render: () => <FeedRow openable={false} row={RESPONDED_ROW} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}
