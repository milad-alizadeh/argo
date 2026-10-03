import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from './button'

const longControlLabel = 'Save the complete configuration for the selected project'

const meta = {
  title: 'Design System/Primitives/Button',
  component: Button,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
  args: { onClick: fn() },
  render: (args) => {
    return (
      <div className="flex max-w-full flex-wrap items-center gap-4">
        <Button onClick={args.onClick}>Save</Button>
        <Button disabled>Unavailable</Button>
        <Button aria-invalid variant="outline">Invalid action</Button>
        <Button aria-label="Search" size="icon-xs"><MagnifyingGlassIcon /></Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra small</Button>
        <Button size="lg">Large</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link action</Button>
        <Button variant="outline"><span className="max-w-52 truncate">{longControlLabel}</span></Button>
      </div>
    )
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Save' })
    save.focus()
    await expect(save).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onClick).toHaveBeenCalledOnce()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByRole('button', { name: 'Search' })).toHaveAccessibleName('Search')
    await expect(canvas.getByRole('button', { name: longControlLabel })).toBeVisible()
  },
}
