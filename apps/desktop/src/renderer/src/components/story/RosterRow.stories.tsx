import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text } from '@/components/ui'
import { SparkleIcon } from '@/components/ui/icons'
import { AGENT_STATES } from './agentState'
import { ROW_CARETS, RosterRow } from './RosterRow'

const meta = {
  title: 'Cockpit/RosterRow',
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

// The three caret states beside a caretless row. `reserved` draws nothing but still holds
// its width, so all four names start at the same x — that alignment is the whole point.
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
