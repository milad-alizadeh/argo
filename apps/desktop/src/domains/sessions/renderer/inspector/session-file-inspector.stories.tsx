import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { SessionEvidenceInspector } from './session-evidence-inspector'

const REPORT_PATH = '/storybook/argo/docs/research/app-name-research.md'
const REPORT_FILE = ['# App name research', '', 'Every name was **screened** twice.'].join('\n')
const SCRIPT_PATH = '/storybook/argo/scripts/measure.ts'
const MIXED_PATH = '/storybook/argo/שלום/مراجعة/測定/long-workspace-name/scripts/measure.ts'

// A story has no preload, so the one read the inspector makes is answered here.
function answerWorkspaceReads(files: Record<string, string | Promise<string | null>>) {
  const before = window.argo
  window.argo = {
    ...before,
    trpc: (async (request) => {
      if (request.path !== 'sessionWorkspaceFileRead') return before.trpc(request)
      const requested = (request.input as { path: string }).path
      return { id: request.id, result: { data: { content: (await files[requested]) ?? null } } }
    }) as typeof window.argo.trpc,
  }
}

const meta = {
  title: 'Features/Sessions/Screens/File Inspector',
  component: SessionEvidenceInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <aside
        role="presentation"
        className="panel-sidebar panel-outer-start panel-outer-end h-dvh border border-border"
      >
        <Story />
      </aside>
    ),
  ],
} satisfies Meta<typeof SessionEvidenceInspector>

export default meta
type Story = StoryObj<typeof SessionEvidenceInspector>

function file(path: string) {
  return { shape: 'file' as const, id: `assistant-1:file:${path}`, path }
}

export const RenderedMarkdown: Story = {
  args: { evidence: file(REPORT_PATH), sessionId: 'session-1' },
  beforeEach: () => answerWorkspaceReads({ [REPORT_PATH]: REPORT_FILE }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'App name research' })).toBeVisible()
    await expect(canvas.getByText('screened').tagName).toBe('STRONG')
    await expect(canvas.getByText(REPORT_PATH)).toBeVisible()
  },
}

export const CodeFile: Story = {
  args: { evidence: file(SCRIPT_PATH), sessionId: 'session-1' },
  beforeEach: () => answerWorkspaceReads({ [SCRIPT_PATH]: 'export const answer = 42\n' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/answer/)).toBeVisible()
    await expect(canvasElement.querySelector('pre')).not.toBeNull()
  },
}

export const UnreadableFile: Story = {
  args: { evidence: file(REPORT_PATH), sessionId: 'session-1' },
  beforeEach: () => answerWorkspaceReads({}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('This file could not be read.')).toBeVisible()
  },
}

export const ReadingFile: Story = {
  args: { evidence: file(REPORT_PATH), sessionId: 'session-1' },
  beforeEach: () => answerWorkspaceReads({ [REPORT_PATH]: new Promise(() => {}) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(REPORT_PATH)).toBeVisible()
    await expect(canvas.getByText('Reading file…')).toBeVisible()
  },
}

export const MixedDirectionPath: Story = {
  args: { evidence: file(MIXED_PATH), sessionId: 'session-1' },
  globals: { viewport: { value: 'compact', isRotated: false } },
  beforeEach: () => answerWorkspaceReads({ [MIXED_PATH]: 'export const answer = 42\n' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(MIXED_PATH)).toBeVisible()
    await expect(await canvas.findByText(/answer/)).toBeVisible()
  },
}
