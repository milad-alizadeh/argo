import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { SessionDiffViewer } from './session-diff-viewer'

const meta = {
  title: 'Features/Sessions/Inspector/Diff Viewer',
  component: SessionDiffViewer,
  args: {
    path: '/Users/milad/Developer/argo/apps/desktop/src/domains/sessions/renderer/session.tsx',
    sessionId: null,
    source: '@@ -1,2 +1,2 @@\n-const status = "old"\n+const status = "ready"',
  },
  decorators: [
    (Story) => (
      <aside
        role="presentation"
        className="panel-sidebar panel-outer-start panel-outer-end h-[420px] w-[360px] flex-none border border-border"
      >
        <Story />
      </aside>
    ),
  ],
} satisfies Meta<typeof SessionDiffViewer>

export default meta
type Story = StoryObj<typeof SessionDiffViewer>

function deferredFileRead() {
  let resolveRead: ((content: string | null) => void) | undefined
  return {
    beforeEach: () => {
      resolveRead = undefined
      const before = window.argo
      window.argo = {
        ...before,
        trpc: (async (request) => {
          if (request.path !== 'sessionWorkspaceFileRead') return before.trpc(request)
          return new Promise((resolve) => {
            resolveRead = (content) => resolve({ id: request.id, result: { data: { content } } })
          })
        }) as typeof window.argo.trpc,
      }
    },
    resolve: (content: string | null) => {
      if (resolveRead === undefined) throw new Error('The current-file read has not started.')
      resolveRead(content)
    },
  }
}

const loadingFileRead = deferredFileRead()
const movedFocusFileRead = deferredFileRead()
const unavailableFileRead = deferredFileRead()

export const CopyDiff: Story = {
  play: async ({ canvasElement }) => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
      const canvas = within(canvasElement)
      const copyButton = canvas.getByRole('button', { name: 'Copy diff' })
      await expect(copyButton).toBeEnabled()
      await userEvent.click(copyButton)
      await expect(writeText).toHaveBeenCalledWith(
        '@@ -1,2 +1,2 @@\n-const status = "old"\n+const status = "ready"',
      )
      await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  },
}

export const CurrentFileAndFocusReturn: Story = {
  args: {
    path: '/workspace/שלום/مراجعة/測定/current-file.ts',
    sessionId: 'session-1',
  },
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      trpc: (async (request) => {
        if (request.path !== 'sessionWorkspaceFileRead') return before.trpc(request)
        return { id: request.id, result: { data: { content: 'export const status = "ready"\n' } } }
      }) as typeof window.argo.trpc,
    }
  },
  play: async ({ canvasElement }) => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const canvas = within(canvasElement)
      await expect(canvas.getByText('/workspace/שלום/مراجعة/測定/current-file.ts')).toBeVisible()
      await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
      await waitFor(async () => {
        await expect(canvas.getByRole('region', { name: 'Current file' })).toHaveTextContent(
          'export const status = "ready"',
        )
      })
      await expect(canvas.getByRole('button', { name: 'Diff' })).toHaveFocus()
      await userEvent.click(canvas.getByRole('button', { name: 'Copy file' }))
      await expect(writeText).toHaveBeenCalledWith('export const status = "ready"\n')
      await userEvent.click(canvas.getByRole('button', { name: 'Diff' }))
      await expect(canvas.getByRole('button', { name: 'Current file' })).toHaveFocus()
      await expect(canvas.getByRole('region', { name: 'File diff' })).toHaveTextContent(
        'const status = "old"',
      )
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  },
}

export const ReadingCurrentFile: Story = {
  args: { sessionId: 'session-1' },
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      trpc: (async (request) => {
        if (request.path !== 'sessionWorkspaceFileRead') return before.trpc(request)
        return new Promise(() => {})
      }) as typeof window.argo.trpc,
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    await expect(canvas.getByText('Reading current file…')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Diff' }))
    await expect(canvas.getByRole('button', { name: 'Current file' })).toHaveFocus()
    await expect(canvas.getByRole('region', { name: 'File diff' })).toHaveTextContent(
      'const status = "old"',
    )
  },
}

export const LoadingFilePreservesFocus: Story = {
  args: { sessionId: 'session-1' },
  beforeEach: loadingFileRead.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    const diffButton = canvas.getByRole('button', { name: 'Diff' })
    await expect(canvas.getByText('Reading current file…')).toBeVisible()
    await expect(diffButton).toHaveFocus()
    await expect(canvas.queryByRole('button', { name: 'Copy file' })).not.toBeInTheDocument()
    loadingFileRead.resolve('export const answer = 42\n')
    await waitFor(async () => {
      await expect(canvas.getByRole('region', { name: 'Current file' })).toHaveTextContent(
        'export const answer = 42',
      )
    })
    await expect(diffButton).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Copy file' })).toBeEnabled()
  },
}

export const LoadingFileKeepsMovedFocus: Story = {
  args: { sessionId: 'session-1' },
  beforeEach: movedFocusFileRead.beforeEach,
  render: (args) => (
    <>
      <SessionDiffViewer {...args} />
      <button type="button">Continue review</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    await expect(canvas.getByText('Reading current file…')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Diff' })).toHaveFocus()
    const continueButton = canvas.getByRole('button', { name: 'Continue review' })
    await userEvent.tab()
    await expect(continueButton).toHaveFocus()
    movedFocusFileRead.resolve('export const answer = 42\n')
    await waitFor(async () => {
      await expect(canvas.getByRole('region', { name: 'Current file' })).toHaveTextContent(
        'export const answer = 42',
      )
    })
    await expect(continueButton).toHaveFocus()
  },
}

export const UnavailableFilePreservesFocus: Story = {
  args: { sessionId: 'session-1' },
  beforeEach: unavailableFileRead.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Current file' }))
    const diffButton = canvas.getByRole('button', { name: 'Diff' })
    await expect(canvas.getByText('Reading current file…')).toBeVisible()
    await expect(diffButton).toHaveFocus()
    unavailableFileRead.resolve(null)
    await expect(await canvas.findByText('Current file is unavailable.')).toBeVisible()
    await expect(diffButton).toHaveFocus()
    await expect(canvas.queryByRole('button', { name: 'Copy file' })).not.toBeInTheDocument()
    await userEvent.click(diffButton)
    await expect(canvas.getByRole('button', { name: 'Current file' })).toHaveFocus()
  },
}
