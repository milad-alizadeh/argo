import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Checkbox } from './checkbox'

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { onCheckedChange: fn(), 'aria-label': 'Viewed' },
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

/** Unchecked, uncontrolled — clicking flips Radix's own `data-state`. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Viewed' })
    await expect(box).toHaveAttribute('data-state', 'unchecked')
    await userEvent.click(box)
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true)
  },
}

/** Checked shows the swapped-in icon atom, never lucide's own. */
export const Checked: Story = {
  args: { checked: true },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Viewed' })
    await expect(box).toHaveAttribute('data-state', 'checked')
    await expect(box.querySelector('svg')).toBeInTheDocument()
  },
}

/** A disabled box drops the pointer and dims, and eats no click. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Viewed' })
    await userEvent.click(box)
    await expect(args.onCheckedChange).not.toHaveBeenCalled()
  },
}
