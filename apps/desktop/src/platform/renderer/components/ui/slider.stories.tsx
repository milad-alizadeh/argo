import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Slider } from './slider'

const meta = { title: 'Design System/Primitives/Slider', component: Slider } satisfies Meta<typeof Slider>
export default meta
type Story = StoryObj<typeof meta>

export const Range: Story = {
  render: () => <label className="grid gap-2">Effort<Slider defaultValue={[40]} max={100} /></label>,
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider', { name: 'Effort' })
    await expect(slider).toHaveAttribute('aria-valuenow', '40')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(slider).toHaveAttribute('aria-valuenow', '41')
  },
}
