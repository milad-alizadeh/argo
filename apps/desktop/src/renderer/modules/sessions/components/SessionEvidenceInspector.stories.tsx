import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionEvidenceInspector } from './SessionEvidenceInspector'

const DIAGRAM_SOURCE = 'flowchart LR\n  Backlog --> Ticket --> Session'

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
  args: { evidence: command, sessionId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('bun test')).toHaveLength(2)
    await expect(canvas.getByText(/13 pass/)).toBeVisible()
  },
}

export const FileDiff: Story = {
  args: {
    sessionId: null,
    evidence: {
      ...command,
      id: 'file',
      evidence: {
        kind: 'diff',
        title: 'src/app.ts',
        source:
          '@@ -8,3 +8,3 @@\n export function run() {\n-  return oldValue\n+  return newValue\n }',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('src/app.ts')).toHaveLength(2)
    await expect(canvas.getByText(/oldValue/)).toBeVisible()
    await expect(canvas.getByText(/newValue/)).toBeVisible()
    await expect(canvas.getAllByText('9')).toHaveLength(2)
    await expect(canvas.getByRole('button', { name: 'Copy diff' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    await expect(canvas.getByText('Current file is unavailable.')).toBeVisible()
  },
}

export const Unavailable: Story = {
  args: { evidence: { ...command, id: 'missing', evidence: null }, sessionId: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Recorded evidence is unavailable.')).toBeVisible()
  },
}

export const Diagram: Story = {
  args: {
    sessionId: null,
    evidence: {
      shape: 'diagram' as const,
      id: 'diagram',
      title: 'Diagram',
      source: DIAGRAM_SOURCE,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Diagram')).toHaveLength(2)
    await waitFor(() => expect(canvasElement.querySelector('svg')).not.toBeNull(), {
      timeout: 5000,
    })
  },
}
