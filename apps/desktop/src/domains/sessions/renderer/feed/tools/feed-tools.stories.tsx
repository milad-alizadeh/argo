import type { Meta } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ToolGroupState } from '../rows/tool-group-state'
import { FeedToolGroup, FeedToolLine } from './feed-tools'

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
  label: 'Ran an unclassified tool',
  lineCounts: null,
  status: 'succeeded' as const,
  evidence: {
    kind: 'output' as const,
    title: 'Ran an unclassified tool',
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

const meta = {
  title: 'Sessions/Feed/Tool Line',
  component: FeedToolLine,
  args: { activeEvidenceId: null, call: edited, onOpen: () => {} },
} satisfies Meta<typeof FeedToolLine>

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

// A settled command is history: the group reads as its count, and the agent's own description
// ("Listing changed files…") and the raw command show only once opened.
export const CommandWithDescriptionLabel = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:described-command',
        label: 'Ran a command',
        calls: [
          {
            ...command,
            id: 'described-command',
            label: 'Listing changed files and scanning them for leftovers',
            text: 'RTK_DISABLED=1 git diff --name-only 5911f4e89~1 HEAD -- apps/desktop/src/harnesses/claude',
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
    const group = canvas.getByRole('button', { name: 'Ran a command' })
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('code')).toBeNull()
    await expect(
      canvas.queryByText('Listing changed files and scanning them for leftovers'),
    ).toBeNull()
    await userEvent.click(group)
    await canvas.findByText('Listing changed files and scanning them for leftovers')
    const codeBlock = await canvas.findByRole('code')
    await expect(codeBlock).toHaveTextContent('RTK_DISABLED=1')
  },
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
    await expect(
      canvas.getByRole('button', { name: /Running bun run typecheck.*Ran 2 commands/ }),
    ).toBeVisible()
  },
}

// The tail group of a running Turn carries the Session's activity as its headline, the same
// line the roster draws, so between calls it still names the latest one.
export const LiveGroupBetweenCalls = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:live',
        label: 'Ran a command, edited a file',
        calls: [command, edited],
        headline: { kind: 'edited', label: 'Edited Composer.tsx', open: false },
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Edited Composer.tsx/ })).toBeVisible()
    await expect(canvas.getByText('· Ran a command, edited a file')).toBeVisible()
    // Settled between two calls, the Session still runs, so the title still shimmers.
    await expect(canvas.getByText('Edited Composer.tsx')).toHaveClass('feed-work-shimmer')
  },
}

export const MixedRunWithLatestCommentary = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:mixed-commentary',
        label: 'Ran 2 commands, edited a file',
        calls: [
          { ...command, id: 'first-command', label: 'Ran first command' },
          { ...edited, id: 'edited-file' },
          { ...command, id: 'second-command', label: 'Ran second command' },
        ],
        thoughts: [
          { id: 'first-commentary', text: 'Reading the output', afterCallIndex: 0 },
          { id: 'second-commentary', text: 'Reviewing the edit', afterCallIndex: 1 },
          { id: 'latest-commentary', text: 'Checking the result', afterCallIndex: 2 },
        ],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const disclosure = canvas.getByRole('button', {
      name: /Checking the result.*Ran 2 commands, edited a file/,
    })
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('button', { name: /Reading the output/ })).toBeNull()
    await expect(canvas.getByText('Checking the result')).not.toHaveClass('feed-work-shimmer')
    await userEvent.click(disclosure)
    await waitFor(() => expect(canvas.getByText('Reading the output')).toBeVisible())
    const first = canvas.getByRole('button', { name: 'Ran first command' })
    const firstCommentary = canvas.getByText('Reading the output')
    const edit = canvas.getByRole('button', { name: 'Edited Composer.tsx +3 −1' })
    const secondCommentary = canvas.getByText('Reviewing the edit')
    const second = canvas.getByRole('button', { name: 'Ran second command' })
    for (const [earlier, later] of [
      [first, firstCommentary],
      [firstCommentary, edit],
      [edit, secondCommentary],
      [secondCommentary, second],
    ]) {
      if (earlier === undefined || later === undefined) throw new Error('Missing grouped work')
      await expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
    await expect(canvas.getAllByText('Checking the result')).toHaveLength(1)
  },
}

export const LiveMixedRunWithCommentary = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:live-commentary',
        label: 'Ran 2 commands, edited a file',
        calls: [command, edited, { ...command, id: 'last-command' }],
        thoughts: [{ id: 'commentary', text: 'Checking the result' }],
        headline: { kind: 'thought', label: 'Checking the result', open: false },
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={closedToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Checking the result.*Ran 2 commands, edited a file/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.getByText('Checking the result')).toHaveClass('feed-work-shimmer')
  },
}

export const UnclassifiedToolGroupOfOne = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:unclassified',
        label: 'Ran a command',
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
