import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CHANGES_VIEWS, ChangesViewToggle } from './ChangesViewToggle'

const meta = {
  title: 'Cockpit/Work/ChangesViewToggle',
  component: ChangesViewToggle,
  args: { view: 'all', onChangeView: fn() },
  argTypes: {
    view: { control: 'select', options: CHANGES_VIEWS },
  },
} satisfies Meta<typeof ChangesViewToggle>

export default meta
type Story = StoryObj<typeof meta>

/** All files selected — the Changes tab's default view. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'All files' })).toHaveAttribute(
      'data-state',
      'on',
    )
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

/** Clicking the side already selected keeps it selected — `type="single"` never clears to
 * nothing (there is no "no view" state). */
export const IgnoresReselect: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('radio', { name: 'All files' }))
    await expect(args.onChangeView).not.toHaveBeenCalled()
  },
}
