// How the Feed shows that a Subagent started and, later, that it finished: one card per
// lifecycle state, and a scene where three agents start together and one has already landed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'

import type { AgentThread } from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import { DelegationThread } from '@/domains/sessions/renderer/feed/delegation/delegation-thread'

const STARTED_AT = new Date(Date.now() - 42_000).toISOString()

const RUNNING: AgentThread = {
  id: 'semantic',
  name: 'semantic_compound_verify',
  phase: 'running',
  progress: 'Reading the compound nouns in the Feed labels',
  result: null,
  startedAt: STARTED_AT,
  endedAt: null,
  tokens: null,
  model: null,
}

const SUCCEEDED: AgentThread = {
  ...RUNNING,
  phase: 'succeeded',
  progress: null,
  result: 'Four labels renamed, none of them compound any more',
  startedAt: '2026-09-18T08:00:00.000Z',
  endedAt: '2026-09-18T08:02:37.000Z',
  tokens: 18_400,
}

const FAILED: AgentThread = {
  ...SUCCEEDED,
  id: 'blind',
  name: 'blind_name_review',
  phase: 'failed',
  result: 'Could not read the locale catalog',
  tokens: 2_700,
}

const SCENE: readonly AgentThread[] = [
  { ...RUNNING, id: 'names', name: 'names_control', progress: 'Collecting every label in use' },
  {
    ...SUCCEEDED,
    id: 'blind-done',
    name: 'blind_name_review',
    result: 'Nine names read out of context, two unclear',
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
