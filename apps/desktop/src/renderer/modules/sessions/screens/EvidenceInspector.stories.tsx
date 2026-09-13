import type { Meta, StoryObj } from '@storybook/react-vite'
import { SessionEvidenceInspector } from '../components/SessionEvidenceInspector'

const meta: Meta<typeof SessionEvidenceInspector> = {
  title: 'Sessions/Screen/Evidence Inspector',
  component: SessionEvidenceInspector,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof SessionEvidenceInspector>
const command = {
  shape: 'tool' as const,
  id: 'command',
  label: 'bun test',
  evidence: { kind: 'output' as const, title: 'bun test', source: '13 pass\n0 fail' },
}
export const CommandOutput: Story = {
  args: { evidence: command },
  render: (args) => (
    <div className="h-dvh w-[248px]">
      <SessionEvidenceInspector {...args} />
    </div>
  ),
}
export const FileContent: Story = {
  args: {
    evidence: {
      ...command,
      id: 'file',
      evidence: { kind: 'document', title: 'src/app.ts', source: 'export {}' },
    },
  },
  render: CommandOutput.render,
}
export const RecordedDiff: Story = {
  args: {
    evidence: {
      ...command,
      id: 'diff',
      evidence: { kind: 'diff', title: 'src/app.ts', source: '-old\n+new' },
    },
  },
  render: CommandOutput.render,
}
export const Unavailable: Story = {
  args: { evidence: { ...command, id: 'missing', evidence: null } },
  render: CommandOutput.render,
}
