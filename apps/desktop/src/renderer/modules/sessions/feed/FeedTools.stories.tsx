import type { Meta } from '@storybook/react'
import { FeedToolGroup, FeedToolLine } from './FeedTools'

const command = {
  shape: 'tool' as const,
  id: 'command',
  kind: 'command' as const,
  label: 'Ran bun test composer',
  detail: '3 passed',
  status: 'succeeded' as const,
  evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
}

const meta: Meta<typeof FeedToolLine> = {
  title: 'Sessions/Feed/Tool Line',
  component: FeedToolLine,
  args: { activeEvidenceId: null, call: command, onOpen: () => {} },
}

export default meta

export const StatusVariants = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...command, status: 'succeeded' }}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...command, status: 'failed' }}
        onOpen={() => {}}
      />
      <FeedToolLine
        activeEvidenceId={null}
        call={{ ...command, status: 'running' }}
        onOpen={() => {}}
      />
    </div>
  ),
}

export const GroupClosed = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:one:two',
        label: 'Ran 1 command · Edited 1 file',
        calls: [command, { ...command, id: 'edit', kind: 'edited', label: 'Edited Composer.tsx' }],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      onOpenChange={() => {}}
      open={false}
    />
  ),
}

export const GroupOpen = {
  render: () => (
    <FeedToolGroup
      group={{
        shape: 'tool-group',
        id: 'tool-group:one:two',
        label: 'Ran 1 command · Edited 1 file',
        calls: [command, { ...command, id: 'edit', kind: 'edited', label: 'Edited Composer.tsx' }],
      }}
      activeEvidenceId={null}
      onOpen={() => {}}
      onOpenChange={() => {}}
      open
    />
  ),
}
