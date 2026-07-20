import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ConsoleChannelTabs } from './ConsoleChannelTabs'
import { type ConsoleCapture, LIVE_CHANNEL_ID, LIVE_CHANNEL_LABEL } from './consoleChannels'

const CAPTURE: ConsoleCapture = {
  id: 't-test',
  label: 'vitest @12:04',
  feed: '▸ Bash: bunx vitest run rotation.test.ts',
}

// The strip is controlled — Storybook's `fn()` args would otherwise leave a click looking
// like nothing happened. This wrapper holds the same state the screen would, so a reviewer
// can click a tab, close the capture, or toggle expand and see the strip actually answer,
// while `args.on*` still fires for the `play` assertions below.
function ControlledConsoleChannelTabs(
  args: React.ComponentProps<typeof ConsoleChannelTabs>,
): React.JSX.Element {
  const [activeChannel, setActiveChannel] = useState(args.activeChannel)
  const [capture, setCapture] = useState(args.capture)
  const [expanded, setExpanded] = useState(args.expanded)

  return (
    <ConsoleChannelTabs
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
  title: 'Cockpit/Console/ChannelTabs',
  component: ConsoleChannelTabs,
  args: {
    activeChannel: LIVE_CHANNEL_ID,
    expanded: false,
    onSelectChannel: fn(),
    onCloseCapture: fn(),
    onToggleExpanded: fn(),
  },
  argTypes: {
    activeChannel: { control: 'text' },
    expanded: { control: 'boolean' },
    panelId: { control: 'text' },
  },
  render: ControlledConsoleChannelTabs,
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleChannelTabs>

export default meta
type Story = StoryObj<typeof meta>

// The empty capture slot: `session · live` alone. It is the only tab that is always there,
// and the expand control sits beside the tablist rather than inside it — only tabs may be
// a tablist's children.
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(1)
    await expect(canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const control = canvas.getByRole('button', { name: /expand/ })
    await expect(canvas.getByRole('tablist').contains(control)).toBe(false)

    await userEvent.click(control)
    await expect(args.onToggleExpanded).toHaveBeenCalled()
  },
}

// One feed opened. The slot holds AT MOST one capture (R13), so the strip never grows past
// two tabs however many feeds get opened.
export const WithCapture: Story = {
  args: { capture: CAPTURE },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(2)

    await userEvent.click(canvas.getByRole('tab', { name: 'vitest @12:04' }))
    await expect(args.onSelectChannel).toHaveBeenCalledWith('t-test')

    await userEvent.click(canvas.getByRole('button', { name: 'Close vitest @12:04' }))
    await expect(args.onCloseCapture).toHaveBeenCalledWith('t-test')
  },
}

// The capture is the channel being read; live stays one click away, and only the selected
// tab points at the panel — it is the only one whose panel is on screen.
export const CaptureActive: Story = {
  args: { capture: CAPTURE, activeChannel: CAPTURE.id, panelId: 'console-panel' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const capture = canvas.getByRole('tab', { name: 'vitest @12:04' })
    await expect(capture).toHaveAttribute('aria-selected', 'true')
    await expect(capture).toHaveAttribute('aria-controls', 'console-panel')
    await expect(canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL })).not.toHaveAttribute(
      'aria-controls',
    )

    await userEvent.click(canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL }))
    await expect(args.onSelectChannel).toHaveBeenCalledWith(LIVE_CHANNEL_ID)
  },
}

// A selection left pointing at a feed that has since been replaced or cleared. The strip
// lights live rather than lighting nothing.
export const StaleSelection: Story = {
  args: { capture: CAPTURE, activeChannel: 'a-gone' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(canvas.getByRole('tab', { name: 'vitest @12:04' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  },
}

// Already tall, so the control offers the way back down.
export const Expanded: Story = {
  args: { capture: CAPTURE, expanded: true },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('button', { name: /collapse/ })
    await expect(control).toHaveAttribute('aria-expanded', 'true')
  },
}

// A tool name long enough to out-run the strip. The chip gives way; the expand control
// keeps its place inside the console rather than being pushed out of it.
export const LongCaptureLabel: Story = {
  args: {
    capture: {
      ...CAPTURE,
      label: 'e2e:playwright --project=chromium --grep session-rail @11:02',
    },
  },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-sm">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const strip = canvasElement.querySelector('[data-slot="console-channel-tabs"]')
    const control = within(canvasElement).getByRole('button', { name: /expand/ })
    const stripBox = (strip as HTMLElement).getBoundingClientRect()
    await expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(
      Math.ceil(stripBox.right),
    )
  },
}
