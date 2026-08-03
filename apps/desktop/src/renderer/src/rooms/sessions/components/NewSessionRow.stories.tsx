import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { NewSessionRow } from './NewSessionRow'

const meta = {
  title: 'Sessions/Roster/NewSessionRow',
  component: NewSessionRow,
  args: { onSpawn: fn() },
  decorators: [
    (Story) => (
      <div className="w-80 bg-background p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NewSessionRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The rail's one permanent affordance, and the whole of its zero-state. Quiet on purpose: it has no
 * plane and no accent, so it never competes with a session that actually wants you.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'New session' })
    await userEvent.click(row)
    await expect(args.onSpawn).toHaveBeenCalledOnce()
  },
}
