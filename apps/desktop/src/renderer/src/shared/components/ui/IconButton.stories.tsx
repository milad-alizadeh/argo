import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { IconButton } from './IconButton'
import { PlusIcon } from './icons'

const meta = {
  title: 'Shared/IconButton',
  component: IconButton,
  args: { label: 'New session', onClick: fn(), children: <PlusIcon className="size-4" /> },
  argTypes: { label: { control: 'text' } },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The bordered square control the roster header and each project row spend on "+" — icon-only,
 * so `label` is the only way it announces itself. Focusable and clickable; what it spawns is
 * the caller's business.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'New session' })
    button.focus()
    await expect(button).toHaveFocus()
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}
