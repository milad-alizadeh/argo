import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Text } from '@/components/ui'
import { SparkleIcon } from '@/components/ui/icons'
import { AGENT_STATES } from './agentState'
import { ROW_CARETS, RosterRow } from './RosterRow'

// The gallery's own state holder: RosterRow reports intent through `onToggle`, but never
// flips its own `caret` — that decision belongs to whatever owns the open/closed state
// upstream (RunRow, PhaseGroup). This is a minimal stand-in for that owner.
function ToggleableRow({
  onToggle,
  ...args
}: React.ComponentProps<typeof RosterRow>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <RosterRow
      {...args}
      caret={open ? 'open' : 'closed'}
      onToggle={() => {
        onToggle?.()
        setOpen((value) => !value)
      }}
    />
  )
}

const meta = {
  title: 'Cockpit/BackgroundTasks/RosterRow',
  component: RosterRow,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    glyph: SparkleIcon,
    stateWord: 'running',
    duration: '3m',
    children: (
      <Text variant="row-strong" className="shrink-0 text-foreground">
        idempotency agent
      </Text>
    ),
  },
  argTypes: {
    caret: { control: 'select', options: [undefined, ...ROW_CARETS] },
    stateWord: { control: 'select', options: [undefined, ...AGENT_STATES] },
    duration: { control: 'text' },
    title: { control: 'text' },
    channelId: { control: 'text' },
  },
} satisfies Meta<typeof RosterRow>

export default meta
type Story = StoryObj<typeof meta>

// The row at its fullest: a glyph, a name and both halves of the trailing meta unit. Only
// the state word carries a hue — the duration stays in the unit's faint ink.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('running')).toHaveClass('text-tone-run')
    await expect(canvas.getByText('3m')).not.toHaveClass('text-tone-run')
  },
}

// A row with nothing to say about its state collapses the meta unit entirely rather than
// leaving an empty column behind.
export const WithoutMeta: Story = {
  args: { stateWord: undefined, duration: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('running')).not.toBeInTheDocument()
    await expect(canvas.queryByText('3m')).not.toBeInTheDocument()
  },
}

// A row the seam can key on: `channelId` lands as `data-channel-id`, which is what binds
// console selection to the row.
export const WithChannel: Story = {
  args: { channelId: 'a-idempotency' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-channel-id="a-idempotency"]')).toBeVisible()
  },
}

// Given `onToggle`, the caret is a real button: a click or a keyboard activation reports
// through `onToggle` and the row's own `aria-expanded` reads off whatever `caret` its owner
// hands back — the row never flips itself.
export const Toggleable: Story = {
  args: { toggleLabel: 'Deep-read', onToggle: fn() },
  render: (args) => <ToggleableRow {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const closed = canvas.getByRole('button', { name: 'Expand Deep-read' })
    await expect(closed).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(closed)
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
    const opened = canvas.getByRole('button', { name: 'Collapse Deep-read' })
    await expect(opened).toHaveAttribute('aria-expanded', 'true')

    opened.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onToggle).toHaveBeenCalledTimes(2)
    await expect(canvas.getByRole('button', { name: 'Expand Deep-read' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  },
}

// A `reserved` caret never becomes a button, even standalone: nothing was handed an
// `onToggle` a click could ever reach, because there is nothing behind it to open.
export const ReservedIsNeverAButton: Story = {
  args: { caret: 'reserved', onToggle: fn() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

// The three caret states beside a caretless row. `reserved` draws nothing but still holds
// its width, so all four names start at the same x — that alignment is the whole point.
// None is wired to `onToggle` here, so all four stay the decorative glyph — the interactive
// button is `Toggleable`'s to prove.
export const EveryCaret: Story = {
  render: (args) => (
    <div className="flex flex-col">
      <RosterRow {...args} caret={undefined} duration="no caret" />
      {ROW_CARETS.map((caret) => (
        <RosterRow key={caret} {...args} caret={caret} duration={caret} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const caret of ROW_CARETS) {
      await expect(canvas.getByText(caret)).toBeInTheDocument()
    }
  },
}
