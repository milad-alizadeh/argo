import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ConsoleChannelTab } from './ConsoleChannelTab'
import { CONSOLE_CHANNEL_KINDS, LIVE_CHANNEL_ID, LIVE_CHANNEL_LABEL } from './consoleChannels'

const meta = {
  title: 'Cockpit/Console/ChannelTab',
  component: ConsoleChannelTab,
  args: {
    id: LIVE_CHANNEL_ID,
    label: LIVE_CHANNEL_LABEL,
    kind: 'live',
    active: true,
    onSelect: fn(),
  },
  argTypes: {
    id: { control: 'text' },
    label: { control: 'text' },
    kind: { control: 'select', options: CONSOLE_CHANNEL_KINDS },
    agent: { control: 'boolean' },
    active: { control: 'boolean' },
    panelId: { control: 'text' },
  },
} satisfies Meta<typeof ConsoleChannelTab>

export default meta
type Story = StoryObj<typeof meta>

// `session · live` is the fixed channel: it is always there and it never closes. The union
// is what enforces that — a `live` tab has no `onClose` to give it a ✕.
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const tab = canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL })
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.queryByRole('button', { name: /^Close/ })).not.toBeInTheDocument()

    await userEvent.click(tab)
    await expect(args.onSelect).toHaveBeenCalledWith(LIVE_CHANNEL_ID)
    // Neither a mouse click nor keyboard focus may paint a ring — the product decision
    // that overrode it applies here first, since the tab is where it was most visible.
    await expect(getComputedStyle(tab).outlineStyle).toBe('none')
    tab.focus()
    await expect(getComputedStyle(tab).outlineStyle).toBe('none')
  },
}

// The tab points at the panel it opens, so the two are linked in the accessibility tree.
// The Console owns both ends; a tab on its own leaves it unset rather than dangling.
export const LinkedToItsPanel: Story = {
  args: { panelId: 'console-panel' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('tab')).toHaveAttribute(
      'aria-controls',
      'console-panel',
    )
  },
}

// A capture is timestamped (that is what tells two runs of one tool apart) and closable —
// its ✕ clears the slot without also switching to the channel it is closing.
export const Capture: Story = {
  args: {
    id: 't-test',
    label: 'vitest @12:04',
    kind: 'capture',
    active: false,
    onClose: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // `onClose` lives on the capture arm alone — that is the invariant the union carries.
    const onClose = args.kind === 'capture' ? args.onClose : undefined
    await expect(canvas.getByRole('tab', { name: 'vitest @12:04' })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Close vitest @12:04' }))
    await expect(onClose).toHaveBeenCalledWith('t-test')
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

// An agent's stream is a channel like any other feed — the sparkle is the only thing that
// says an Agent produced it (R15).
export const AgentChannel: Story = {
  args: {
    id: 'a-review',
    label: 'review agent @11:56',
    kind: 'capture',
    agent: true,
    active: true,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toBeInTheDocument()
  },
}

// A capture label long enough to out-run the strip. The chip gives way rather than pushing
// what sits beside it out of the console.
export const LongCaptureLabel: Story = {
  args: {
    id: 't-e2e',
    label: 'e2e:playwright --project=chromium --grep session-rail @11:02',
    kind: 'capture',
    active: false,
    onClose: fn(),
  },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="flex w-64 items-center bg-background/55 px-inset py-snug">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector('[data-slot="console-channel-tab"]')
    await expect((chip as HTMLElement).clientWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

// Every tab the strip can hold, in one frame — the visual-diff surface for the chip: the
// selected wash, the sparkle, and the ✕ that only captures carry.
export const EveryChannel: Story = {
  render: (args) => (
    <div className="flex items-center gap-gap bg-background/55 px-inset py-snug">
      <ConsoleChannelTab {...args} kind="live" />
      <ConsoleChannelTab {...args} kind="live" active={false} />
      <ConsoleChannelTab
        {...args}
        id="t-test"
        label="vitest @12:04"
        kind="capture"
        active={false}
        onClose={fn()}
      />
      <ConsoleChannelTab
        {...args}
        id="a-review"
        label="review agent @11:56"
        kind="capture"
        agent
        active
        onClose={fn()}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(4)
    // Only the two captures can be closed; the live channel is fixed.
    await expect(canvas.getAllByRole('button', { name: /^Close/ })).toHaveLength(2)

    // The chip's box is the ladder's `sm` step and nothing more: 4+4 padding, a 1px border
    // each side, and the meta line box. Its nested controls spend no box of their own, so
    // adding one would show up here as a taller strip.
    const chip = canvasElement.querySelector('[data-slot="console-channel-tab"]')
    await expect((chip as HTMLElement).offsetHeight).toBe(24)
  },
}
