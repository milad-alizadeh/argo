import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BranchNameField } from './BranchNameField'

const meta = {
  title: 'Shell/GitControls/BranchManage/BranchNameField',
  component: BranchNameField,
  args: {
    title: 'New branch',
    submitLabel: 'Create',
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof BranchNameField>

export default meta
type Story = StoryObj<typeof meta>

/** What `New branch` and `Rename` open instead of firing. It takes the caret on open, and its
 * submit stays refused until there is a name to submit — an operation with no name could only
 * ever fail, which is why the row opens this rather than dispatching. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: 'New branch' })
    await expect(field).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Create' })).toBeDisabled()
    await userEvent.type(field, '  feat/tokens  ')
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('feat/tokens')
  },
}

/** Whitespace is not a name: the surrounding spaces are trimmed away and what is left cannot be
 * submitted, so the guard is at the boundary rather than a state the menu renders. */
export const WhitespaceOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'New branch' }), '   ')
    await expect(canvas.getByRole('button', { name: 'Create' })).toBeDisabled()
  },
}
