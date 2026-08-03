import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ROOMS } from '../../shellModel'
import { RoomSwitcher } from './RoomSwitcher'

const meta = {
  title: 'Shell/TopBar/RoomSwitcher',
  component: RoomSwitcher,
  args: { room: 'sessions', onSelectRoom: fn() },
  argTypes: {
    room: {
      control: 'select',
      options: [...ROOMS],
      description: 'Which room the stage is showing.',
      table: { type: { summary: 'Room' } },
    },
  },
} satisfies Meta<typeof RoomSwitcher>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Sessions, the launch default — you land in the running world.
 *
 * The switcher is a router, so the room you are in is marked the way assistive technology reads
 * a current destination (`aria-current`), not the way it reads a selected tab. Each entry shows
 * the chord that reaches it, so the keymap is learned from the chrome rather than a help page.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const nav = within(within(canvasElement).getByRole('navigation', { name: 'Rooms' }))
    await expect(nav.getByRole('button', { name: 'Sessions ⌘1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const work = nav.getByRole('button', { name: 'Work ⌘2' })
    await expect(work).not.toHaveAttribute('aria-current')
    await userEvent.click(work)
    await expect(args.onSelectRoom).toHaveBeenCalledWith('work')
  },
}

/**
 * Each room as the active one, read off `ROOMS` so the switcher and the model cannot drift apart.
 *
 * The visual-diff surface for the active entry: it is the only one that takes ink, and its chord
 * warms to the primary while the others stay faint.
 */
export const EveryRoom: Story = {
  render: (args) => (
    <div className="flex flex-col gap-region">
      {ROOMS.map((room) => (
        <RoomSwitcher {...args} key={room} room={room} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const switchers = within(canvasElement).getAllByRole('navigation', { name: 'Rooms' })
    await expect(switchers).toHaveLength(ROOMS.length)
    for (const [index, switcher] of switchers.entries()) {
      const current = within(switcher).getAllByRole('button', { current: 'page' })
      await expect(current).toHaveLength(1)
      await expect(current[0]).toHaveTextContent(new RegExp(ROOMS[index], 'i'))
    }
  },
}
