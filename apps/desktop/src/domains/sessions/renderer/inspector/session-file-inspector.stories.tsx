import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { SessionEvidenceInspector } from '@/domains/sessions/renderer/inspector/session-evidence-inspector'

const REPORT_PATH = '/storybook/argo/docs/research/app-name-research.md'
const REPORT_FILE = ['# App name research', '', 'Every name was **screened** twice.'].join('\n')
const SCRIPT_PATH = '/storybook/argo/scripts/measure.ts'

// A story has no preload, so the one read the inspector makes is answered here.
function answerWorkspaceReads(files: Record<string, string>) {
  window.argo = {
    ...window.argo,
    readWorkspaceFile: (request: { sessionId: string; path: string }) =>
      Promise.resolve({
        version: 1,
        type: 'session.file.read',
        requestId: 'storybook-file',
        content: files[request.path] ?? null,
      }),
  }
}

const meta: Meta<typeof SessionEvidenceInspector> = {
  title: 'Sessions/Screen/File Inspector',
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
