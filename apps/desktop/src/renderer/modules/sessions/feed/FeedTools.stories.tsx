import type { Meta, StoryObj } from '@storybook/react'
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
type Story = StoryObj<typeof FeedToolLine>

export const Succeeded: Story = {}
export const Failed: Story = { args: { call: { ...command, status: 'failed' } } }
export const InProgress: Story = { args: { call: { ...command, status: 'running' } } }

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
