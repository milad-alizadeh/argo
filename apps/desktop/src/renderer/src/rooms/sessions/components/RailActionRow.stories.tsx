import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PlusIcon } from '@/shared/components/ui'
import { RailActionRow } from './RailActionRow'

const meta = {
  title: 'Sessions/Roster/RailActionRow',
  component: RailActionRow,
  args: { icon: PlusIcon, label: 'New session', onClick: fn() },
  argTypes: {
    icon: { control: false, table: { type: { summary: 'IconAtom' } } },
    label: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-80 bg-background p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RailActionRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The shape both ends of the rail wear: glyph, label, no plane and no accent. Its two callers
 * (`NewSessionRow`, `ArchivedFooter`) story only what they add on top — their own label and, for the
 * footer, the `aria-expanded`/`aria-controls` wiring to the list it opens.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'New session' })
    await userEvent.click(row)
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}
