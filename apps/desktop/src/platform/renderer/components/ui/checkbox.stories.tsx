import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Checkbox } from './checkbox'

const meta = { title: 'Foundations/Primitives/Checkbox', component: Checkbox } satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>

export const Checked: Story = {
  render: () => <label className="flex items-center gap-2"><Checkbox defaultChecked /> Include archived projects</label>,
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', { name: 'Include archived projects' })
    await expect(checkbox).toBeChecked()
    await userEvent.click(checkbox)
    await expect(checkbox).not.toBeChecked()
  },
}
