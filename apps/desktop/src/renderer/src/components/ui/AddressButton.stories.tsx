import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AddressButton } from './AddressButton'
import { FINDING_STATES } from './findingState'
import { StateChip } from './StateChip'
import { Text } from './Text'

// The row's own handler, spied at module scope so the play can assert it stayed silent.
const onRowClick = fn()

const meta = {
  title: 'Cockpit/AddressButton',
  component: AddressButton,
  args: { state: 'open', onClick: fn() },
  argTypes: {
    state: { control: 'select', options: FINDING_STATES },
    size: { control: 'select', options: ['default', 'sm'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof AddressButton>

export default meta
type Story = StoryObj<typeof meta>

// The label is always the next action, never the current state — the state is reported by
// the StateChip travelling beside it.
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Address' })
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

// A finding whose fix is still dispatching can't be advanced twice.
export const Disabled: Story = { args: { state: 'addressing', disabled: true } }

// Both homes of a finding are themselves clickable (they route to the diff), so the
// control has to swallow the click rather than trusting every call site to remember.
export const InsideClickableRow: Story = {
  render: (args) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for FindingRow, which owns the real keyboard route to the diff.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same — this frame exists only to prove the click stops at the button.
    <div
      onClick={onRowClick}
      className="flex items-center gap-inset rounded-xl border border-inset-hair bg-inset p-inset"
    >
      <Text variant="row" className="text-foreground-bright">
        renderer/src/App.tsx:42
      </Text>
      <StateChip state={args.state} />
      <AddressButton {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    onRowClick.mockClear()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Address' }))
    await expect(args.onClick).toHaveBeenCalledOnce()
    // The row heard nothing — no diff jump behind the action.
    await expect(onRowClick).not.toHaveBeenCalled()
  },
}

// Every state across both sizes — the visual-diff surface for the state-cycling tones.
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-gap">
      {FINDING_STATES.map((state) => (
        <div className="flex items-center gap-gap" key={state}>
          <Text variant="meta" className="w-24 text-foreground-faint">
            {state}
          </Text>
          <AddressButton state={state} />
          <AddressButton state={state} size="sm" />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button')).toHaveLength(FINDING_STATES.length * 2)
    await expect(canvas.getAllByRole('button', { name: 'Mark fixed' })).toHaveLength(2)
  },
}
