import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Toggle } from './toggle'

const meta = { title: 'Design System/Primitives/Toggle', component: Toggle } satisfies Meta<typeof Toggle>
export default meta
type Story = StoryObj<typeof meta>

export const Pressed: Story = {
  render: () => <Toggle aria-label="Pin project" defaultPressed>Pin project</Toggle>,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Pin project' })
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
  },
}
