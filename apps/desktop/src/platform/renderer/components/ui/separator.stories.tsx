import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Separator } from './separator'

const meta = { title: 'Foundations/Primitives/Separator', component: Separator } satisfies Meta<typeof Separator>
export default meta
type Story = StoryObj<typeof meta>

export const Sections: Story = {
  render: () => <div className="w-64"><p>Project access</p><Separator className="my-3" /><p>Session history</p></div>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('separator')).toBeVisible()
  },
}
