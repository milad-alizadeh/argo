import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CHANGES_VIEWS, ChangesViewToggle } from './ChangesViewToggle'

const meta = {
  title: 'Cockpit/Work/WorkTabs/ChangesViewToggle',
  component: ChangesViewToggle,
  args: { view: 'all', onChangeView: fn() },
  argTypes: {
    view: { control: 'select', options: CHANGES_VIEWS },
  },
} satisfies Meta<typeof ChangesViewToggle>

export default meta
type Story = StoryObj<typeof meta>

/** All files selected — the Changes tab's default view. Reselecting the active side is a no-op
 * (`type="single"` never clears to nothing); switching sides fires the change. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'All files' })).toHaveAttribute(
      'data-state',
      'on',
    )
    await userEvent.click(canvas.getByRole('radio', { name: 'All files' }))
    await expect(args.onChangeView).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('radio', { name: 'By commit' }))
    await expect(args.onChangeView).toHaveBeenCalledWith('commits')
  },
}

/** By commit selected — the grouped view. */
export const ByCommit: Story = {
  args: { view: 'commits' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'By commit' })).toHaveAttribute(
      'data-state',
      'on',
    )
  },
}
