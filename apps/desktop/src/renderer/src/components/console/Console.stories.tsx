import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Console } from './Console'
import { captureLabel } from './captureLabel'
import {
  type ConsoleCapture,
  type ConsoleLiveChannel,
  LIVE_CHANNEL_ID,
  LIVE_CHANNEL_LABEL,
} from './consoleChannels'

const LIVE: ConsoleLiveChannel = {
  prompt: 'auth refactor $',
  tail: '▸ Edit src/auth/legacy.ts · verify() delegates to rotation core',
}

const CAPTURE: ConsoleCapture = {
  id: 't-test',
  label: captureLabel('vitest', new Date(2026, 6, 20, 12, 4)),
  feed: `▸ Bash: bunx vitest run rotation.test.ts

 ✓ rotation.test.ts (7)
   ✓ issues a fresh pair atomically
   ✓ persists via store.put in one txn

 Test Files  1 passed (1)
      Tests  7 passed (7)`,
}

// The console is controlled — Storybook's `fn()` args would otherwise leave a click
// looking like nothing happened. This wrapper holds the same state the screen would, so a
// reviewer can click a tab, close the capture, or toggle expand and see the console
// actually answer, while `args.on*` still fires for the `play` assertions below.
function ControlledConsole(args: React.ComponentProps<typeof Console>): React.JSX.Element {
  const [activeChannel, setActiveChannel] = useState(args.activeChannel)
  const [capture, setCapture] = useState(args.capture)
  const [expanded, setExpanded] = useState(args.expanded)

  return (
    <Console
      {...args}
      activeChannel={activeChannel}
      capture={capture}
      expanded={expanded}
      onSelectChannel={(id) => {
        setActiveChannel(id)
        args.onSelectChannel(id)
      }}
      onCloseCapture={(id) => {
        setCapture(undefined)
        args.onCloseCapture(id)
      }}
      onToggleExpanded={() => {
        setExpanded((value) => !value)
        args.onToggleExpanded()
      }}
    />
  )
}

const meta = {
  title: 'Cockpit/Console',
  component: Console,
  args: {
    live: LIVE,
    activeChannel: LIVE_CHANNEL_ID,
    expanded: false,
    height: '170px',
    onSelectChannel: fn(),
    onCloseCapture: fn(),
    onToggleExpanded: fn(),
  },
  argTypes: {
    activeChannel: { control: 'text' },
    expanded: { control: 'boolean' },
    // A CSS length, because the screen's splitter — not the console — owns the number.
    height: { control: 'text' },
  },
  render: ControlledConsole,
  // The console spans its pane; the frame stands in for the session panel above it.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Console>

export default meta
type Story = StoryObj<typeof meta>

// Nothing captured: the console is the session's own channel and nothing else.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(1)

    // The tab and the panel it opens are linked: the Console owns both ids.
    const panel = canvas.getByRole('tabpanel', { name: LIVE_CHANNEL_LABEL })
    await expect(canvas.getByRole('tab')).toHaveAttribute('aria-controls', panel.id)
  },
}

// A tool feed opened from the timeline. It fills the ONE capture slot — never a pane —
// and the live channel is still a tab away.
export const CaptureActive: Story = {
  args: { capture: CAPTURE, activeChannel: CAPTURE.id },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const panel = canvas.getByRole('tabpanel', { name: 'captured feed' })
    await expect(panel.textContent).toContain('Tests  7 passed (7)')
    await expect(
      canvas.queryByRole('tabpanel', { name: LIVE_CHANNEL_LABEL }),
    ).not.toBeInTheDocument()

    // R13 opens a capture by clicking a TIMELINE row — focus starts outside the console, so
    // the console pulls it onto the panel. Esc has to work without touching the console first:
    // the note on the feed is the promise this keeps.
    await expect(panel).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(args.onSelectChannel).toHaveBeenCalledWith(LIVE_CHANNEL_ID)
  },
}

// The slot is filled but the live channel is the one being read: Esc has nowhere to
// return to, so it stays out of the way of anything else listening for it.
export const CaptureIdle: Story = {
  args: { capture: CAPTURE },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(2)

    await userEvent.click(canvas.getByRole('tabpanel', { name: LIVE_CHANNEL_LABEL }))
    await userEvent.keyboard('{Escape}')
    await expect(args.onSelectChannel).not.toHaveBeenCalled()
  },
}

// The tall console. The height arrives as a CSS length the screen owns — here a literal,
// in the app the splitter-driven custom property.
export const Expanded: Story = {
  args: { capture: CAPTURE, expanded: true, height: '420px' },
  play: async ({ canvasElement }) => {
    const console = canvasElement.querySelector('[data-slot="console"]')
    await expect(console).toHaveAttribute('data-expanded', 'true')
    await expect((console as HTMLElement).style.height).toBe('420px')
  },
}
