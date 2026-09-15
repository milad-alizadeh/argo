import type { Meta } from '@storybook/react'
import { expect, within } from 'storybook/test'
import { FeedToolGroup, FeedToolLine } from './feed-tools'
import { ToolGroupState } from './tool-group-state'

const command = {
  shape: 'tool' as const,
  id: 'command',
  kind: 'command' as const,
  label: 'Ran a command',
  lineCounts: null,
  status: 'succeeded' as const,
  evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
  text: 'bun test composer',
}

const unclassified = {
  shape: 'tool' as const,
  id: 'unclassified',
  kind: 'tool' as const,
  label: 'Called an unclassified tool',
  lineCounts: null,
  status: 'succeeded' as const,
  evidence: {
    kind: 'output' as const,
    title: 'Called an unclassified tool',
    source: '{"ok":true}',
  },
  text: null,
}

const edited = {
  shape: 'tool' as const,
  id: 'edit',
  kind: 'edited' as const,
  label: 'Edited Composer.tsx',
  lineCounts: { added: 3, removed: 1 },
  status: 'succeeded' as const,
  evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
  text: null,
}

const openToolGroups = new ToolGroupState()
openToolGroups.setOpen('tool-group:command', true)
openToolGroups.setOpen('tool-group:unclassified', true)
openToolGroups.setOpen('tool-group:one:two', true)
openToolGroups.setOpen('tool-group:two-commands', true)
openToolGroups.setOpen('command-1', true)
openToolGroups.setOpen('command-2', true)
const closedToolGroups = new ToolGroupState()

const meta: Meta<typeof FeedToolLine> = {
  title: 'Sessions/Feed/Tool Line',
  component: FeedToolLine,
  args: { activeEvidenceId: null, call: edited, onOpen: () => {} },
}

export default meta

export const StatusVariants = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'succeeded' }}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'failed' }}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'running' }}
        onOpen={() => {}}
      />
    </div>
  ),
  // A failed edit's label reads red, its numbers keep their own green and red, and they sit right
  // after the label rather than at the far edge.
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const [succeeded, failed] = canvas.getAllByRole('button', { name: /Edited Composer.tsx/ })
    if (succeeded === undefined || failed === undefined) throw new Error('Two tool lines expected.')
    await expect(failed).toHaveAccessibleName(/Failed/)
    const label = within(failed).getByText('Edited Composer.tsx')
    const removed = within(failed).getByText('−1')
    await expect(getComputedStyle(label).color).toBe(getComputedStyle(removed).color)
    await expect(getComputedStyle(label).color).not.toBe(
      getComputedStyle(within(succeeded).getByText('Edited Composer.tsx')).color,
    )
    const added = within(failed).getByText('+3')
    await expect(getComputedStyle(added).color).toBe(
      getComputedStyle(within(succeeded).getByText('+3')).color,
    )
    const gap = added.getBoundingClientRect().left - label.getBoundingClientRect().right
    await expect(gap).toBeLessThan(16)
  },
}

export const CommandGroupOfOne = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:command',
        label: 'Ran a command',
        calls: [command],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={openToolGroups}
    />
  ),
}

export const CommandGroupOfTwo = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:two-commands',
        label: 'Ran 2 commands',
        calls: [
          { ...command, id: 'command-1', text: 'bun test' },
          { ...command, id: 'command-2', text: 'bun run typecheck' },
        ],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={openToolGroups}
    />
  ),
}

// While a call still runs, the closed group names that call, not its summary.
export const GroupWithARunningCommand = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:running',
        label: 'Ran 2 commands',
        calls: [
          { ...command, id: 'running-1', label: 'Ran bun test' },
          {
            ...command,
            id: 'running-2',
            label: 'Ran bun run typecheck',
            status: 'running' as const,
            evidence: null,
          },
        ],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Ran bun run typecheck/ })).toBeVisible()
    await expect(canvas.queryByText('Ran 2 commands')).toBeNull()
  },
}

// The tail group of a running Turn names its latest call even between calls.
export const LiveGroupBetweenCalls = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:live',
        label: 'Ran a command, edited a file',
        calls: [command, edited],
      }}
      live
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Edited Composer.tsx/ })).toBeVisible()
    await expect(canvas.queryByText('Ran a command, edited a file')).toBeNull()
  },
}

export const UnclassifiedToolGroupOfOne = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:unclassified',
        label: 'Called a tool',
        calls: [unclassified],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={openToolGroups}
    />
  ),
}

export const GroupClosed = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:one:two',
        label: 'Ran a command, edited a file',
        calls: [command, edited],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
}

export const GroupOpen = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:one:two',
        label: 'Ran a command, edited a file',
        calls: [command, edited],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={openToolGroups}
    />
  ),
}
