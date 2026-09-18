import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionEvidenceInspector } from './session-evidence-inspector'

const DIAGRAM_SOURCE = 'flowchart LR\n  Backlog --> Ticket --> Session'

const command = {
  shape: 'tool' as const,
  id: 'command',
  kind: 'command' as const,
  label: 'bun test',
  lineCounts: null,
  status: 'succeeded' as const,
  evidence: { kind: 'output' as const, title: 'bun test', source: '13 pass\n0 fail' },
  text: 'bun test',
}

const meta: Meta<typeof SessionEvidenceInspector> = {
  title: 'Sessions/Screen/Evidence Inspector',
  component: SessionEvidenceInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-dvh min-h-0 w-full">
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
    await expect(canvas.getByText('bun test')).toBeVisible()
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
    await expect(canvas.getByText('src/app.ts')).toBeVisible()
    await expect(canvas.getByText(/oldValue/)).toBeVisible()
    await expect(canvas.getByText(/newValue/)).toBeVisible()
    await expect(canvas.getAllByText('9')).toHaveLength(2)
    const lineNumbers = [...canvasElement.querySelectorAll('pre [aria-hidden="true"].w-6')].filter(
      (line) => line.textContent !== '',
    )
    await expect(lineNumbers.map((line) => line.textContent)).toEqual(['8', '9', '9', '10'])
    await expect(canvas.getByRole('button', { name: 'Copy diff' })).toBeVisible()
    const pre = canvasElement.querySelector('pre')
    await expect(pre).not.toBeNull()
    await expect(getComputedStyle(pre as HTMLPreElement).padding).toBe('0px')
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    await expect(canvas.getByText('Current file is unavailable.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Diff' })).toHaveFocus()
  },
}

// A Codex `apply_patch` over two files: one section per file, named by its file, each hunk
// numbered from its own start.
export const PatchOverTwoFiles: Story = {
  args: {
    sessionId: null,
    evidence: {
      ...command,
      id: 'patch',
      evidence: {
        kind: 'diff',
        title: 'Edited 2 files',
        source: [
          'Update File: /repo/src/app.ts',
          '@@ -0,0 +0,0 @@',
          '-  return oldValue',
          '+  return newValue',
          'Add File: /repo/docs/note.md',
          '+hello',
        ].join('\n'),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('app.ts')).toBeVisible()
    await expect(canvas.getByText('note.md')).toBeVisible()
    await expect(canvas.queryByText(/Update File/)).toBeNull()
    await expect(canvas.getByText(/newValue/)).toBeVisible()
    await expect(canvas.getByText(/hello/)).toBeVisible()
    const headers = canvasElement.querySelectorAll('header')
    await expect(headers).toHaveLength(2)
    for (const header of headers) await expect(getComputedStyle(header).position).toBe('sticky')
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-language="typescript"]')).not.toBeNull(),
    )
  },
}

export const ReadDocument: Story = {
  args: {
    sessionId: null,
    evidence: {
      ...command,
      id: 'read',
      evidence: {
        kind: 'document',
        title:
          '/Users/milad/Developer/argo/.claude/worktrees/ticket-2202-concrete-refusal/hooks/worktree-names.mjs',
        source:
          'export function recipeFor(name) {\n  if (!rules.named) return null\n  return name\n}',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/worktree-names\.mjs/)).toBeVisible()
    // The highlighter loads its grammar on first use, which takes over a second under a full run.
    await waitFor(
      () => expect(canvasElement.querySelector('code[data-highlighted="true"]')).not.toBeNull(),
      { timeout: 5000 },
    )
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
