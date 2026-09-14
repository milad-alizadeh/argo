import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { sessionDelegation, sessionShellCommand } from '../session-fixtures'
import { SessionWorkInspector } from './SessionWorkInspector'

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

// The rail's own selection, so a play function can operate the story the way a reader does.
function Rail(props: Partial<React.ComponentProps<typeof SessionWorkInspector>>) {
  const [delegationId, setDelegationId] = useState<string | null>(null)
  const [shellId, setShellId] = useState<string | null>(null)
  return (
    <SessionWorkInspector
      delegations={DELEGATIONS}
      shell={SHELL}
      delegationTokens={{ 'call-review': 18_400, 'call-sweep': 2700 }}
      now={NOW}
      selectedDelegationId={delegationId}
      onSelectDelegation={setDelegationId}
      selectedShellId={shellId}
      onSelectShell={setShellId}
      {...props}
    />
  )
}

const meta: Meta<typeof SessionWorkInspector> = {
  title: 'Sessions/Screen/Work Inspector',
  component: SessionWorkInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-(--size-session-inspector) bg-sidebar">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionWorkInspector>

export const SubagentsAndShell: Story = {
  render: () => <Rail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Background Agents · 2')).toBeVisible()
    await expect(canvas.getByText('Shell · 2')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Main/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Duration and spend are the two facts a Subagent row adds (#1582).
    await expect(canvas.getByRole('button', { name: /Find every caller/ })).toHaveTextContent(
      '1m 12s · 2.7k tokens',
    )
    await expect(canvas.getByRole('button', { name: /Interface review/ })).toHaveTextContent(
      '5m 0s · 18k tokens',
    )
  },
}

// A background Shell alone still draws the rail: nothing about it needs a Subagent (#1582 AC1).
export const ShellOnly: Story = {
  render: () => <Rail delegations={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Shell · 2')).toBeVisible()
    await expect(canvas.queryByText(/Background Agents/)).toBeNull()
    await expect(canvas.getByRole('button', { name: /npm run watch/ })).toHaveTextContent('4m 30s')
  },
}

// A finished command waits behind its own count, and opening the fold is how a reader reaches it.
export const RunningAndFinishedStates: Story = {
  render: () => <Rail delegations={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Running.*npm run watch/ })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /bun run build/ })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '1 finished' }))
    await expect(canvas.getByRole('button', { name: /Completed.*bun run build/ })).toBeVisible()
  },
}

export const PicksASubagentFeed: Story = {
  render: () => <Rail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Interface review/ }))
    await expect(canvas.getByRole('button', { name: /Interface review/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByRole('button', { name: /Main/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // Main is the way back to the Session's own Feed.
    await userEvent.click(canvas.getByRole('button', { name: /Main/ }))
    await expect(canvas.getByRole('button', { name: /Main/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

// Every row is a button, so the keyboard reaches the rail in order and Enter picks a row.
export const KeyboardPicksARow: Story = {
  render: () => <Rail delegations={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const watch = canvas.getByRole('button', { name: /npm run watch/ })
    watch.focus()
    await expect(watch).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(watch).toHaveAttribute('aria-pressed', 'true')
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: '1 finished' })).toHaveFocus()
  },
}
