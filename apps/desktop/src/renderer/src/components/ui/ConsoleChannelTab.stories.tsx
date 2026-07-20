import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ConsoleChannelTab } from './ConsoleChannelTab'
import { CONSOLE_CHANNEL_KINDS, LIVE_CHANNEL_ID, LIVE_CHANNEL_LABEL } from './consoleChannels'

const meta = {
  title: 'Cockpit/ConsoleChannelTab',
  component: ConsoleChannelTab,
  args: {
    id: LIVE_CHANNEL_ID,
    label: LIVE_CHANNEL_LABEL,
    kind: 'live',
    active: true,
    onSelect: fn(),
    onClose: fn(),
  },
  argTypes: {
    id: { control: 'text' },
    label: { control: 'text' },
    kind: { control: 'select', options: CONSOLE_CHANNEL_KINDS },
    agent: { control: 'boolean' },
    active: { control: 'boolean' },
    closable: { control: 'boolean' },
  },
} satisfies Meta<typeof ConsoleChannelTab>

export default meta
type Story = StoryObj<typeof meta>

// `session · live` is the fixed channel: it is always there and it never closes, so no ✕
// is offered however the tab is styled.
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const tab = canvas.getByRole('tab', { name: LIVE_CHANNEL_LABEL })
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.queryByRole('button', { name: /^Close/ })).not.toBeInTheDocument()

    await userEvent.click(tab)
    await expect(args.onSelect).toHaveBeenCalledWith(LIVE_CHANNEL_ID)
  },
}

// A capture is timestamped (that is what tells two runs of one tool apart) and closable —
// its ✕ clears the slot without also switching to the channel it is closing.
export const Capture: Story = {
  args: { id: 't-test', label: 'vitest @12:04', kind: 'capture', active: false, closable: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'vitest @12:04' })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Close vitest @12:04' }))
    await expect(args.onClose).toHaveBeenCalledWith('t-test')
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
    closable: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toBeInTheDocument()
  },
}

// Every tab the strip can hold, in one frame — the visual-diff surface for the chip: the
// selected wash, the sparkle, and the ✕ that only captures carry.
export const EveryChannel: Story = {
  render: (args) => (
    <div className="flex items-center gap-gap bg-background/55 px-inset py-snug">
      <ConsoleChannelTab {...args} />
      <ConsoleChannelTab {...args} active={false} />
      <ConsoleChannelTab
        {...args}
        id="t-test"
        label="vitest @12:04"
        kind="capture"
        active={false}
        closable
      />
      <ConsoleChannelTab
        {...args}
        id="a-review"
        label="review agent @11:56"
        kind="capture"
        agent
        active
        closable
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(4)
    // Only the two captures can be closed; the live channel is fixed.
    await expect(canvas.getAllByRole('button', { name: /^Close/ })).toHaveLength(2)
  },
}
