import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

const meta = {
  title: 'UI/ToggleGroup',
  component: ToggleGroup,
  args: { type: 'single', onValueChange: fn() },
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

/** `type="single"` — the All files | By commit view flag ChangesViewToggle builds from. */
export const Default: Story = {
  args: { defaultValue: 'all' },
  render: (args) => (
    <ToggleGroup {...args} aria-label="Changes view">
      <ToggleGroupItem value="all">All files</ToggleGroupItem>
      <ToggleGroupItem value="commits">By commit</ToggleGroupItem>
    </ToggleGroup>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const all = canvas.getByRole('radio', { name: 'All files' })
    const commits = canvas.getByRole('radio', { name: 'By commit' })
    await expect(all).toHaveAttribute('data-state', 'on')
    await userEvent.click(commits)
    await expect(args.onValueChange).toHaveBeenCalledWith('commits')
  },
}
