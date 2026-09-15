import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, screen, userEvent, within } from 'storybook/test'

import { sessionDelegation, sessionShellCommand } from '../session-fixtures'
import { SessionWorkButtons } from './SessionWorkButtons'

// A fixed clock, so every duration these stories draw is the same on every run.
const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const DELEGATIONS = [
  sessionDelegation({
    id: 'call-review',
    label: 'Interface review',
    startedAt: '2026-09-02T08:00:00.000Z',
  }),
  sessionDelegation({
    id: 'call-sweep',
    label: 'Find every caller',
    landed: true,
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

// The header's own selection, so a play function can operate the story the way a reader does.
function Header(props: Partial<React.ComponentProps<typeof SessionWorkButtons>>) {
  const [delegationId, setDelegationId] = useState<string | null>(null)
  const [shellId, setShellId] = useState<string | null>(null)
  return (
    <div className="flex h-(--size-chrome-bar) items-center gap-2 border-b border-border/60 px-3">
      <SessionWorkButtons
        delegations={DELEGATIONS}
        delegationTokens={{ 'call-review': 18_400, 'call-sweep': 2700 }}
        now={NOW}
        onSelectDelegation={(id) => {
          setDelegationId(id)
          setShellId(null)
        }}
        onSelectShell={(id) => {
          setShellId(id)
          setDelegationId(null)
        }}
        selectedDelegationId={delegationId}
        selectedShellId={shellId}
        shell={SHELL}
        {...props}
      />
      <output className="type-meta text-muted-foreground">
        {`Picked: ${delegationId ?? shellId ?? 'nothing'}`}
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

// Each button opens its own list, split into what is still going and what has come back.
export const RunningAndFinishedGroups: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 2' }))
    const running = await screen.findByRole('group', { name: 'Running' })
    const finished = screen.getByRole('group', { name: 'Finished' })
    // Duration and spend are the two facts a Subagent row adds (#1582).
    await expect(
      within(running).getByRole('menuitem', { name: /Interface review/ }),
    ).toHaveTextContent('Running · 5m 0s · 18k tokens')
    await expect(
      within(finished).getByRole('menuitem', { name: /Find every caller/ }),
    ).toHaveTextContent('Done · 1m 12s · 2.7k tokens')
  },
}

// The two lists are separate: a command never appears under the Subagents button.
export const ShellList: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Shell · 2' }))
    await expect(await screen.findByRole('menuitem', { name: /npm run watch/ })).toHaveTextContent(
      'Running · 4m 30s',
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
      delegations={DELEGATIONS.filter((delegation) => delegation.landed)}
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
  render: () => <Header delegations={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Shell · 2' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Subagents/ })).toBeNull()
  },
}
