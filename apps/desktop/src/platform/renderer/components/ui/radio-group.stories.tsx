import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { RadioGroup, RadioGroupItem } from './radio-group'

const meta = { title: 'Design System/Primitives/Radio Group', component: RadioGroup } satisfies Meta<typeof RadioGroup>
export default meta
type Story = StoryObj<typeof meta>

export const Selection: Story = {
  render: () => <RadioGroup aria-label="Default branch" defaultValue="main"><label className="flex items-center gap-2"><RadioGroupItem value="main" /> main</label><label className="flex items-center gap-2"><RadioGroupItem value="develop" /> develop</label></RadioGroup>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const main = canvas.getByRole('radio', { name: 'main' })
    const develop = canvas.getByRole('radio', { name: 'develop' })
    await expect(main).toBeChecked()
    await userEvent.click(develop)
    await expect(develop).toBeChecked()
    await expect(main).not.toBeChecked()
  },
}
