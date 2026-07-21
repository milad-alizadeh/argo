import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ConsoleChannel } from './ConsoleChannel'
import { LIVE_CHANNEL_LABEL } from './consoleChannels'

const FEED = `▸ Bash: bunx vitest run rotation.test.ts

 ✓ rotation.test.ts (7)
   ✓ issues a fresh pair atomically
   ✓ persists via store.put in one txn

 Test Files  1 passed (1)
      Tests  7 passed (7)`

const meta = {
  title: 'Console/Channel',
  component: ConsoleChannel,
  args: { feed: FEED },
  // The channel fills whatever the console gives it; the frame stands in for that.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="flex h-48 w-2xl flex-col border border-input">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleChannel>

export default meta
type Story = StoryObj<typeof meta>

// A capture is a frozen feed — no caret, no typing — and it says how to get back, because
// nothing else on the surface does.
export const Capture: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const panel = canvas.getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel).not.toHaveAttribute('contenteditable')

    // The feed is rendered as text: a line that looks like markup stays readable.
    await expect(canvas.getByText(/esc/)).toBeInTheDocument()
    await expect(panel.textContent).toContain('Test Files  1 passed (1)')
  },
}

// A tool that has not written a line yet. `feedLines('')` is one empty line, not nothing,
// so the panel is a named empty surface with the return note still on it.
export const CaptureOfEmptyFeed: Story = {
  args: { feed: '' },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel.textContent).toBe(`captured feed — esc returns to ${LIVE_CHANNEL_LABEL}`)
  },
}

// A feed the tool wrote with markup in it. It is data, not HTML, so it renders as the
// characters it is.
export const CaptureOfMarkup: Story = {
  args: { feed: '▸ Read src/App.tsx\n<div class="app">\n  <b>bold</b>' },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel.textContent).toContain('<div class="app">')
    await expect(panel.querySelector('.app')).not.toBeInTheDocument()
  },
}
