import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'

import { sessionShellCommand, sessionSubagent } from '@/domains/sessions/renderer/session-fixtures'
import { SessionWorkButtons } from './session-work-buttons'

// A fixed clock, so every duration these stories draw is the same on every run.
const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const DELEGATIONS = [
  sessionSubagent({
    id: 'call-review',
    label: 'Interface review',
    startedAt: '2026-09-02T08:00:00.000Z',
  }),
  sessionSubagent({
    id: 'call-sweep',
    label: 'Find every caller',
    state: 'completed',
    startedAt: '2026-09-02T08:00:10.000Z',
    endedAt: '2026-09-02T08:01:22.000Z',
  }),
]

const SHELL = [
  sessionShellCommand({
    id: 'call-watch',
    command: 'npm run watch',
    background: true,
    startedAt: '2026-09-02T08:00:30.000Z',
  }),
  sessionShellCommand({
    id: 'call-build',
    command: 'bun run build',
    background: true,
    state: 'completed',
    startedAt: '2026-09-02T08:01:00.000Z',
    endedAt: '2026-09-02T08:01:43.000Z',
    result: 'Background command "bun run build" completed (exit code 0)',
  }),
]

function expectDotAlignedWithTitle(item: HTMLElement) {
  const dot = item.querySelector<HTMLElement>('[aria-hidden="true"]')
  const title = within(item).getByText('Interface review')
  if (dot === null) throw new Error('Expected a state dot.')
  const dotCenter = dot.getBoundingClientRect().top + dot.getBoundingClientRect().height / 2
  const titleBounds = title.getBoundingClientRect()
  const titleCenter = titleBounds.top + titleBounds.height / 2
  expect(Math.abs(dotCenter - titleCenter)).toBeLessThanOrEqual(1)
}

// The header's own selection, so a play function can operate the story the way a reader does.
function Header(props: Partial<React.ComponentProps<typeof SessionWorkButtons>>) {
  const [subagentId, setDelegationId] = useState<string | null>(null)
  const [shellId, setShellId] = useState<string | null>(null)
  return (
    <div className="flex h-(--size-chrome-bar) items-center gap-2 border-b border-border/60 px-3">
      <SessionWorkButtons
        subagents={DELEGATIONS}
        subagentUsage={{
          'call-review': { tokens: 18_400, model: 'claude-opus-5' },
          'call-sweep': { tokens: 2700, model: 'gpt-5.6-terra' },
        }}
        now={NOW}
        onSelectDelegation={(id) => {
          setDelegationId(id)
          setShellId(null)
        }}
        onSelectShell={(id) => {
          setShellId(id)
          setDelegationId(null)
        }}
        selectedDelegationId={subagentId}
        selectedShellId={shellId}
        shell={SHELL}
        {...props}
      />
      <output className="type-meta text-muted-foreground">
        {`Picked: ${subagentId ?? shellId ?? 'nothing'}`}
      </output>
    </div>
  )
}

const meta: Meta<typeof SessionWorkButtons> = {
  title: 'Sessions/Screen/Work Buttons',
  component: SessionWorkButtons,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof SessionWorkButtons>

export const SubagentsAndShell: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Subagents · 2' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Shell · 2' })).toBeVisible()
  },
}

export const ReadableAgentName: Story = {
  render: () => (
    <Header
      subagents={[sessionSubagent({ id: 'call-standards', label: 'standards_review' })]}
      shell={[]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 1' }))
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('menuitem', { name: /Standards review/ })
          .some((item) => item.checkVisibility()),
      ).toBe(true),
    )
  },
}

// Each button opens its own list, split into what is still going and what has come back.
export const RunningAndFinishedGroups: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 2' }))
    const running = await screen.findByRole('group', { name: 'Running' })
    const finished = screen.getByRole('group', { name: 'Finished' })
    // Model, duration and spend remain visible in the same order; the colored mark carries state.
    const runningItem = within(running).getByRole('menuitem', { name: /Interface review/ })
    await expect(runningItem).toHaveTextContent('claude-opus-5 · 5m 0s · 18k tokens')
    await expect(within(runningItem).getByText('Running')).toHaveClass('sr-only')
    expectDotAlignedWithTitle(runningItem)
    const finishedItem = within(finished).getByRole('menuitem', { name: /Find every caller/ })
    await expect(finishedItem).toHaveTextContent('gpt-5.6-terra · 1m 12s · 2.7k tokens')
    await expect(within(finishedItem).getByText('Done')).toHaveClass('sr-only')
  },
}

// The two lists are separate: a command never appears under the Subagents button.
export const ShellList: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Shell · 2' }))
    await expect(await screen.findByRole('menuitem', { name: /npm run watch/ })).toHaveTextContent(
      '4m 30s',
    )
    await expect(screen.getByRole('menuitem', { name: /bun run build/ })).toHaveTextContent(
      'Completed',
    )
    await expect(screen.queryByRole('menuitem', { name: /Interface review/ })).toBeNull()
  },
}

// Picking a row is what opens the inspector, so the pick is the whole behaviour to prove here.
export const PicksASubagent: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 2' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Interface review/ }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Picked: call-review')
  },
}

// Everything has come back, so both badges are grey rather than green.
export const EverythingFinished: Story = {
  render: () => (
    <Header
      subagents={DELEGATIONS.filter((delegation) => delegation.state === 'completed')}
      shell={SHELL.filter((command) => command.state !== 'running')}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 1' }))
    const finished = await screen.findByRole('group', { name: 'Finished' })
    await expect(
      within(finished).getByRole('menuitem', { name: /Find every caller/ }),
    ).toBeInTheDocument()
    await expect(screen.queryByRole('group', { name: 'Running' })).toBeNull()
  },
}

// One kind alone draws one button: a background Shell needs no Subagent beside it (#1582 AC1).
export const ShellOnly: Story = {
  render: () => <Header subagents={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Shell · 2' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Subagents/ })).toBeNull()
  },
}
