import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { SessionEvidenceInspector } from './SessionEvidenceInspector'

const command = {
  shape: 'tool' as const,
  id: 'command',
  kind: 'command' as const,
  label: 'bun test',
  detail: '13 passed',
  status: 'succeeded' as const,
  evidence: { kind: 'output' as const, title: 'bun test', source: '13 pass\n0 fail' },
}

const meta: Meta<typeof SessionEvidenceInspector> = {
  title: 'Sessions/Screen/Evidence Inspector',
  component: SessionEvidenceInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-(--size-session-inspector)">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionEvidenceInspector>

export const CommandOutput: Story = {
  args: { evidence: command },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('bun test')).toHaveLength(2)
    await expect(canvas.getByText(/13 pass/)).toBeVisible()
  },
}

// File content and a diff draw the same recorded-text block.
export const RecordedText: Story = {
  args: {
    evidence: {
      ...command,
      id: 'file',
      evidence: { kind: 'document', title: 'src/app.ts', source: 'export {}' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('src/app.ts')).toBeVisible()
    await expect(canvas.getByText('export {}')).toBeVisible()
  },
}

export const Unavailable: Story = {
  args: { evidence: { ...command, id: 'missing', evidence: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Recorded evidence is unavailable.')).toBeVisible()
  },
}
