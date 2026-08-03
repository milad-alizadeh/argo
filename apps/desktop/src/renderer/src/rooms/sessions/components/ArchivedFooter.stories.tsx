import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ArchivedFooter } from './ArchivedFooter'

const meta = {
  title: 'Sessions/Roster/ArchivedFooter',
  component: ArchivedFooter,
  args: { count: 3, open: false, controls: 'archived-list', onToggle: fn() },
  argTypes: { count: { control: { type: 'range', min: 0, max: 99, step: 1 } } },
  decorators: [
    (Story) => (
      <div className="w-80 bg-background p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArchivedFooter>

export default meta
type Story = StoryObj<typeof meta>

/** Closed: the count is the only thing it says, and clicking it reports the intent to open. */
export const Closed: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'Archived (3)' })
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(row)
    await expect(args.onToggle).toHaveBeenCalledOnce()
  },
}

/** Open: the same row, now pointing at the list it revealed. */
export const Open: Story = {
  args: { open: true },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'Archived (3)' })
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await expect(row).toHaveAttribute('aria-controls', 'archived-list')
  },
}
