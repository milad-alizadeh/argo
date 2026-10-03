import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { sessionShellCommand, sessionSubagent } from '@/mocks/sessions/session-rows'
import { SessionWorkButtons } from './session-work-buttons'
import type { WorkEntry } from './session-work-entries'
import { SessionWorkMenu } from './session-work-menu'

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

function countEntry(running: boolean): WorkEntry {
  return {
    id: running ? 'running-work' : 'finished-work',
    title: running ? 'Review interface' : 'Review complete',
    monospace: false,
    status: running ? 'running' : 'completed',
    mark: 'bg-current',
    state: running ? 'Running' : 'Done',
    facts: '',
  }
}

export function WorkCountSamples() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-4">
      {[true, false].map((running) => (
        <SessionWorkMenu
          entries={[countEntry(running)]}
          icon="agent"
          key={String(running)}
          label={running ? 'Running work' : 'Finished work'}
          onSelect={setPicked}
          selectedId={picked}
        />
      ))}
    </div>
  )
}

// The header's own selection, so a play function can operate the story the way a reader does.
function Header(props: Partial<React.ComponentProps<typeof SessionWorkButtons>>) {
  const [subagentId, setDelegationId] = useState<string | null>(null)
  const [shellId, setShellId] = useState<string | null>(null)
  return (
    <div className="flex h-(--size-chrome-bar) items-center gap-2 border-b border-border px-3">
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
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Work/Work Buttons',
  component: SessionWorkButtons,
  excludeStories: ['WorkCountSamples'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SessionWorkButtons>

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
    await expect(runningItem).toHaveAccessibleName(/Running/)
    const finishedItem = within(finished).getByRole('menuitem', { name: /Find every caller/ })
    await expect(finishedItem).toHaveTextContent('gpt-5.6-terra · 1m 12s · 2.7k tokens')
    await expect(finishedItem).toHaveAccessibleName(/Done/)
  },
}

export const UnknownSubagent: Story = {
  render: () => (
    <Header
      subagents={[sessionSubagent({ id: 'codex-child', label: 'Codex child', state: 'unknown' })]}
      shell={[]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Subagents · 1' }))
    const unknown = await screen.findByRole('group', { name: 'Unknown' })
    await waitFor(() =>
      expect(within(unknown).getByRole('menuitem', { name: /Codex child/ })).toBeVisible(),
    )
    await expect(screen.queryByRole('group', { name: 'Finished' })).toBeNull()
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
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    const trigger = canvas.getByRole('button', { name: 'Subagents · 2' })
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await expect(await screen.findByRole('menuitem', { name: /Interface review/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
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

export const NotificationCounts: Story = {
  render: () => <WorkCountSamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Running work · 1' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Review interface Running/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Running work · 1' }))
    await expect(
      await screen.findByRole('menuitem', { name: /Review interface Running/ }),
    ).toHaveAttribute('aria-current', 'true')
  },
}

export const KeyboardSelection: Story = {
  render: () => <Header />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Subagents · 2' })
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await screen.findByRole('menuitem', { name: /Interface review/ })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: /Interface review/ })).toHaveFocus(),
    )
    await userEvent.keyboard('{ArrowDown}')
    await expect(screen.getByRole('menuitem', { name: /Find every caller/ })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(
      await screen.findByRole('menuitem', { name: /Find every caller/ }),
    ).toHaveAttribute('aria-current', 'true')
  },
}

export const LongDetailsNarrow: Story = {
  render: () => (
    <div className="w-72 p-4">
      <SessionWorkMenu
        entries={[
          {
            ...countEntry(true),
            title: 'Review the configuration and permission menus across the application',
            facts:
              'claude-opus-5 · 25m 30s · 184k tokens · checking keyboard navigation and accessibility',
          },
        ]}
        icon="agent"
        label="Subagents"
        onSelect={() => {}}
        selectedId={null}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Subagents · 1' }))
    await expect(
      await screen.findByRole('menuitem', {
        name: /Review the configuration and permission menus/,
      }),
    ).toHaveAccessibleName(/checking keyboard navigation and accessibility/)
  },
}

export const FailedAndInterruptedWork: Story = {
  render: () => (
    <Header
      subagents={[
        sessionSubagent({ id: 'failed-review', label: 'Failed review', state: 'failed' }),
        sessionSubagent({ id: 'stopped-review', label: 'Stopped review', state: 'interrupted' }),
      ]}
      shell={[
        sessionShellCommand({ id: 'failed-shell', command: 'bun run failed', state: 'failed' }),
        sessionShellCommand({
          id: 'stopped-shell',
          command: 'bun run stopped',
          state: 'interrupted',
        }),
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [trigger, names] of [
      ['Subagents · 2', [/Failed review Failed/, /Stopped review Interrupted/]],
      ['Shell · 2', [/bun run failed Failed/, /bun run stopped Interrupted/]],
    ] as const) {
      await userEvent.click(canvas.getByRole('button', { name: trigger }))
      await screen.findByRole('group', { name: 'Finished' })
      await expect(screen.queryByRole('group', { name: 'Running' })).toBeNull()
      for (const name of names) {
        const finished = screen.getByRole('group', { name: 'Finished' })
        await userEvent.click(within(finished).getByRole('menuitem', { name }))
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
        await waitFor(() => expect(canvas.getByRole('button', { name: trigger })).toHaveFocus())
        await userEvent.click(canvas.getByRole('button', { name: trigger }))
        await expect(await screen.findByRole('menuitem', { name })).toHaveAttribute(
          'aria-current',
          'true',
        )
      }
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      await waitFor(() => expect(canvas.getByRole('button', { name: trigger })).toHaveFocus())
    }
  },
}
