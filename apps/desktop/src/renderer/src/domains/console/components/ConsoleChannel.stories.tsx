import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ConsoleChannel, type ConsoleChannelProps } from './ConsoleChannel'
import { CONSOLE_CHANNEL_KINDS, LIVE_CHANNEL_LABEL } from './consoleChannels'

const TAIL = '▸ Edit src/auth/legacy.ts · verify() delegates to rotation core'

const FEED = `▸ Bash: bunx vitest run rotation.test.ts

 ✓ rotation.test.ts (7)
   ✓ issues a fresh pair atomically
   ✓ persists via store.put in one txn

 Test Files  1 passed (1)
      Tests  7 passed (7)`

// Typed off the props rather than `typeof ConsoleChannel`: the variants are a discriminated
// union, and Storybook's arg inference collapses a union component's args to `never`.
const meta: Meta<ConsoleChannelProps> = {
  title: 'Console/Channel',
  component: ConsoleChannel,
  argTypes: { kind: { control: 'select', options: CONSOLE_CHANNEL_KINDS } },
  // The channel fills whatever the console gives it; the frame stands in for that.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="flex h-48 w-2xl flex-col border border-input">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<ConsoleChannelProps>

// The live channel is the session's own surface: it takes typing, and the caret sits after
// the prompt. The caret is STATIC — the screen's one animation budget is the ribbon's.
export const Live: Story = {
  args: { kind: 'live', prompt: 'auth refactor $', tail: TAIL },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: LIVE_CHANNEL_LABEL })
    await expect(panel).toHaveAttribute('contenteditable', 'true')

    const caret = canvasElement.querySelector('.caret-cell')
    await expect(caret).toBeInTheDocument()
    await expect(getComputedStyle(caret as Element).animationName).toBe('none')
  },
}

// A session that has said nothing yet: prompt and caret, no tail above them — and no blank
// line standing in for the output that has not arrived.
export const LiveWithoutTail: Story = {
  args: { kind: 'live', prompt: 'auth refactor $', tail: '' },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: LIVE_CHANNEL_LABEL })
    await expect(panel.textContent?.startsWith('auth refactor $')).toBe(true)
  },
}

// A capture is a frozen feed — no caret, no typing — and it says how to get back, because
// nothing else on the surface does.
export const Capture: Story = {
  args: { kind: 'capture', feed: FEED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const panel = canvas.getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel).not.toHaveAttribute('contenteditable')
    await expect(canvasElement.querySelector('.caret-cell')).not.toBeInTheDocument()

    // The feed is rendered as text: a line that looks like markup stays readable.
    await expect(canvas.getByText(/esc/)).toBeInTheDocument()
    await expect(panel.textContent).toContain('Test Files  1 passed (1)')
  },
}

// A tool that has not written a line yet. `feedLines('')` is one empty line, not nothing,
// so the panel is a named empty surface with the return note still on it.
export const CaptureOfEmptyFeed: Story = {
  args: { kind: 'capture', feed: '' },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel.textContent).toBe(`captured feed — esc returns to ${LIVE_CHANNEL_LABEL}`)
  },
}

// A feed the tool wrote with markup in it. It is data, not HTML, so it renders as the
// characters it is.
export const CaptureOfMarkup: Story = {
  args: { kind: 'capture', feed: '▸ Read src/App.tsx\n<div class="app">\n  <b>bold</b>' },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel.textContent).toContain('<div class="app">')
    await expect(panel.querySelector('.app')).not.toBeInTheDocument()
  },
}

// Both variants side by side — the visual-diff surface for what separates them: the caret
// and prompt on one, the return note on the other.
export const BothVariants: Story = {
  args: { kind: 'live', prompt: 'auth refactor $', tail: TAIL },
  render: () => (
    <div className="flex h-full w-full flex-col">
      <ConsoleChannel kind="live" prompt="auth refactor $" tail={TAIL} className="flex-1" />
      <ConsoleChannel kind="capture" feed={FEED} className="flex-1 border-input border-t" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('tabpanel')).toHaveLength(2)
  },
}
