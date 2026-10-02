import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
      <div className="h-[420px] w-[360px] overflow-hidden border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionDiffViewer>

export default meta
type Story = StoryObj<typeof SessionDiffViewer>

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
