import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Switch } from './switch'

const meta = { title: 'Design System/Primitives/Switch', component: Switch } satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>

export const State: Story = {
  render: () => <label className="flex items-center gap-2"><Switch defaultChecked /> Notifications</label>,
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('switch', { name: 'Notifications' })
    await expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    await expect(toggle).not.toBeChecked()
  },
}
