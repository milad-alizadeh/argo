import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Textarea } from './textarea'

const meta = { title: 'Foundations/Primitives/Textarea', component: Textarea } satisfies Meta<typeof Textarea>
export default meta
type Story = StoryObj<typeof meta>

export const Entry: Story = {
  render: () => <Textarea aria-label="Project notes" placeholder="Add a note" />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Project notes' })
    await userEvent.type(input, 'Review the workspace')
    await expect(input).toHaveValue('Review the workspace')
  },
}
