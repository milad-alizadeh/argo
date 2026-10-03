import type { Meta } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { projectLiveFeedRows } from '@/domains/sessions/api/feed/live-feed-rows'
import { groupToolRuns } from '@/domains/sessions/api/feed/tool-groups'
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
const staleToolGroups = new ToolGroupState()
const severalToolGroups = new ToolGroupState()
const lazyToolGroups = new ToolGroupState()
const editToolGroups = new ToolGroupState()
const commentaryToolGroups = new ToolGroupState()
const liveCommentaryGroups = new ToolGroupState()

const meta = {
  title: 'Features/Sessions/Feed/Tool Line',
  component: FeedToolLine,
  args: { activeEvidenceId: null, call: edited, live: false, onOpen: () => {} },
} satisfies Meta<typeof FeedToolLine>

export default meta

export const StatusVariants = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'succeeded' }}
        live={false}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'failed' }}
        live={false}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...edited, status: 'running' }}
        live
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
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
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
      await userEvent.click(canvas.getByRole('button', { name: 'Copy command and result' }))
      await expect(writeText).toHaveBeenCalledWith(
        'RTK_DISABLED=1 git diff --name-only 5911f4e89~1 HEAD -- apps/desktop/src/harnesses/claude\n3 pass',
      )
      await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
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

const staleRunningGroup = {
  shape: 'tool-group' as const,
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
}

// A group that is not the live tail is history, even with a call that never reported its end:
// it reads as its count, and no call in it says Running.
export const GroupWithAStaleRunningCommand = {
  render: () => (
    <FeedToolGroup
      group={staleRunningGroup}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={staleToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Ran 2 commands' })
    await userEvent.click(group)
    await canvas.findByRole('button', { name: 'Ran bun run typecheck' })
    await expect(canvas.queryByText(/Running/)).toBeNull()
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
    await expect(canvas.getByRole('button', { name: 'Edited Composer.tsx' })).toBeVisible()
    // The live title is the activity alone: no count, and no separator before one.
    await expect(canvas.queryByText(/Ran a command, edited a file/)).toBeNull()
    // Settled between two calls, the Session still runs, so the title still shimmers.
    await expect(canvas.getByText('Edited Composer.tsx')).toHaveClass('feed-work-shimmer')
  },
}

export const LiveCommentaryTitlesLatestGroup = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:live-commentary',
        label: 'Ran 2 commands',
        calls: [
          { ...command, id: 'pull-request-command-1', label: 'Ran first command' },
          { ...command, id: 'pull-request-command-2', label: 'Ran second command' },
        ],
        headline: { kind: 'thought', label: 'Creating new pull requests', open: true },
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={liveCommentaryGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Creating new pull requests' })
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText('Ran 2 commands')).toBeNull()
    await userEvent.click(group)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Ran first command' })).toBeVisible(),
    )
    await expect(canvas.getByRole('button', { name: 'Ran second command' })).toBeVisible()
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
    const disclosure = canvas.getByRole('button', { name: 'Ran 2 commands, edited a file' })
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText('Checking the result')).toBeNull()
    await expect(canvas.queryByRole('button', { name: /Reading the output/ })).toBeNull()
    await userEvent.click(disclosure)
    await waitFor(() => expect(canvas.getByText('Reading the output')).toBeVisible())
    await expect(canvas.getByText('Checking the result')).not.toHaveClass('feed-work-shimmer')
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
    await expect(canvas.getByText('Checking the result')).toBeVisible()
  },
}

const liveGroup = {
  shape: 'tool-group' as const,
  id: 'tool-group:live-command',
  label: 'Ran 2 commands, edited a file',
  calls: [
    command,
    edited,
    {
      ...command,
      id: 'last-command',
      label: 'Ran bun run typecheck',
      status: 'running' as const,
      evidence: null,
    },
  ],
  thoughts: [{ id: 'commentary', text: 'Checking the result', afterCallIndex: 1 }],
  headline: { kind: 'command' as const, label: 'Ran bun run typecheck', open: true },
}

// A Turn with several groups: the newest activity titles the live tail, the older group settles,
// and only the live title shimmers.
export const LiveTurnWithSeveralGroups = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FeedToolGroup
        group={{ ...staleRunningGroup, id: 'tool-group:stale' }}
        activeEvidenceId={null}
        onOpen={() => {}}
        toolGroups={severalToolGroups}
      />
      <FeedToolGroup
        group={liveGroup}
        activeEvidenceId={null}
        onOpen={() => {}}
        toolGroups={severalToolGroups}
      />
    </div>
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Ran 2 commands' })).toBeVisible()
    const live = canvas.getByRole('button', { name: 'Running bun run typecheck' })
    await expect(canvas.getByText('Running bun run typecheck')).toHaveClass('feed-work-shimmer')
    await expect(canvasElement.querySelectorAll('.feed-work-shimmer')).toHaveLength(1)
    await userEvent.click(live)
    await waitFor(() => expect(canvas.getByText('Checking the result')).toBeVisible())
    await expect(canvasElement.querySelectorAll('.feed-work-shimmer')).toHaveLength(1)
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

// Whether the body is still mounted when the trigger reports collapsed, read in the observer's
// microtask so the check never races the end of the closing transition.
function mountedAtCollapse(trigger: HTMLElement, body: HTMLElement) {
  return new Promise<boolean>((resolve) => {
    const observer = new MutationObserver(() => {
      if (trigger.getAttribute('aria-expanded') !== 'false') return
      observer.disconnect()
      resolve(body.isConnected)
    })
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] })
  })
}

// A closed group builds no body, so a long Feed pays for titles alone; the body mounts on open,
// stays through the closing transition, and leaves once it ends.
export const ClosedGroupBuildsNoBody = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:lazy',
        label: 'Ran a command, edited a file',
        calls: [command, edited],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      toolGroups={lazyToolGroups}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Ran a command, edited a file' })
    await expect(canvas.queryByText('Edited Composer.tsx')).toBeNull()
    await userEvent.click(group)
    const edit = await canvas.findByRole('button', { name: 'Edited Composer.tsx +3 −1' })
    // A panel closed before it has grown has no height to animate, so Base UI unmounts it at once.
    await waitFor(() => expect(edit).toBeVisible())
    const bodyAtCollapse = mountedAtCollapse(group, edit)
    await userEvent.click(group)
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(await bodyAtCollapse).toBe(true)
    await waitFor(() => expect(canvas.queryByText('Edited Composer.tsx')).toBeNull())
  },
}

// A command, then one patch over two files, as the Feed projects them from Harness content.
const [settledEdits] = groupToolRuns(
  projectLiveFeedRows(
    [
      {
        kind: 'command',
        id: 'check',
        command: 'bun test',
        status: 'completed',
        output: '3 pass',
        stderr: null,
      },
      {
        kind: 'fileChange',
        id: 'patch',
        status: 'completed',
        changes: [
          {
            path: '/repo/app.txt',
            change: 'update',
            diff: '@@ -1,2 +1,2 @@\n alpha\n-beta\n+gamma\n',
          },
          { path: '/repo/notes.md', change: 'add', diff: 'hello\n' },
        ],
      },
    ],
    [],
  ),
)
const openEditEvidence = fn()

// A settled group counts each file in the order the work ran, and every file opens its own diff.
export const SettledCommandAndEdits = {
  render: () =>
    settledEdits?.shape === 'tool-group' ? (
      <FeedToolGroup
        group={settledEdits}
        activeEvidenceId={null}
        onOpen={openEditEvidence}
        toolGroups={editToolGroups}
      />
    ) : null,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', {
      name: 'Ran a command, edited a file, created a file',
    })
    await userEvent.click(group)
    await userEvent.click(await canvas.findByRole('button', { name: 'Edited app.txt +1 −1' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Created notes.md +1 −0' }))
    const opened = openEditEvidence.mock.calls.map(([row]) => row.evidence?.source ?? '')
    await expect(opened).toEqual([
      expect.stringContaining('Update File: /repo/app.txt'),
      expect.stringContaining('Add File: /repo/notes.md'),
    ])
  },
}

// Settled commentary stays in its group, and a blank thought never leaves a bare separator.
export const CommentaryTitles = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FeedToolGroup
        group={{
          shape: 'tool-group',
          id: 'tool-group:markdown-commentary',
          label: 'Ran a command',
          calls: [command],
          thoughts: [{ id: 'markdown', text: '**Checking** the `feed` result', afterCallIndex: 0 }],
        }}
        activeEvidenceId={null}
        onOpen={() => {}}
        toolGroups={commentaryToolGroups}
      />
      <FeedToolGroup
        group={{
          shape: 'tool-group',
          id: 'tool-group:blank-commentary',
          label: 'Edited a file',
          calls: [{ ...edited, id: 'blank-edit' }],
          thoughts: [
            { id: 'blank', text: '  ', afterCallIndex: 0 },
            { id: 'rule', text: '---', afterCallIndex: 0 },
          ],
        }}
        activeEvidenceId={null}
        onOpen={() => {}}
        toolGroups={commentaryToolGroups}
      />
    </div>
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('button', { name: 'Ran a command' })
    await expect(group).toBeVisible()
    await expect(canvas.queryByText('Checking')).toBeNull()
    await userEvent.click(group)
    await expect(canvas.getByText('Checking').tagName).toBe('STRONG')
    await expect(canvas.getByText('feed').tagName).toBe('CODE')
    await expect(canvas.queryByText(/\*\*/)).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Edited a file' })).toBeVisible()
  },
}
