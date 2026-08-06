import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ConnectionChip } from './ConnectionChip'

const meta = {
  title: 'Shell/TopBar/ConnectionChip',
  component: ConnectionChip,
  args: { grant: 'needs-reconnect', onReconnect: fn() },
  argTypes: {
    grant: {
      control: 'select',
      options: ['none', 'connected', 'needs-reconnect'],
      description: 'The account-level GitHub grant.',
      table: { type: { summary: 'GrantState' } },
    },
  },
} satisfies Meta<typeof ConnectionChip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A grant the provider has refused.
 *
 * The one connection failure with a global blast radius and a real action, so it is the one that
 * earns permanent chrome. Pressing it opens the connect panel, where both ways out live.
 */
export const NeedsReconnect: Story = {
  play: async ({ args, canvasElement }) => {
    const chip = within(canvasElement)
    await userEvent.click(chip.getByRole('button', { name: /needs reconnect/ }))
    await expect(args.onReconnect).toHaveBeenCalled()
  },
}

/**
 * A healthy grant, which renders nothing at all.
 *
 * There is no green light: permanent chrome carries only what changes, and a chip that was
 * always there would be one more thing to learn to ignore.
 */
export const Silent: Story = {
  args: { grant: 'connected' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}
