import type { Meta } from '@storybook/react'
import { FeedToolGroup, FeedToolLine } from './FeedTools'
import { ToolGroupState } from './tool-group-state'

const command = {
  shape: 'tool' as const,
  id: 'command',
  kind: 'command' as const,
  label: 'Ran a command',
  detail: null,
  status: 'succeeded' as const,
  evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
  text: 'bun test composer',
}

const edited = {
  shape: 'tool' as const,
  id: 'edit',
  kind: 'edited' as const,
  label: 'Edited Composer.tsx',
  detail: '+3 −1',
  status: 'succeeded' as const,
  evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
  text: null,
}

const openToolGroups = new ToolGroupState()
openToolGroups.setOpen('tool-group:command', true)
openToolGroups.setOpen('tool-group:one:two', true)
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
