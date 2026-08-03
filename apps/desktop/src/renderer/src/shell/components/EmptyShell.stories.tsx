import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EmptyShell } from './EmptyShell'

const meta = {
  title: 'Shell/EmptyShell',
  component: EmptyShell,
  args: { onConnect: fn() },
} satisfies Meta<typeof EmptyShell>

export default meta
type Story = StoryObj<typeof meta>

/**
 * First run, with nothing connected.
 *
 * The whole stage is one line and one way forward. There is deliberately no skeleton roster, no
 * sample project and no zeroed counters: at this tier Argo knows nothing, and showing a shape it
 * cannot fill is the one thing the cockpit is not allowed to do.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const stage = within(canvasElement)
    await expect(stage.getByText('Connect a provider to begin.')).toBeVisible()
    const connect = stage.getByRole('button', { name: 'Connect a provider' })
    await userEvent.click(connect)
    await expect(args.onConnect).toHaveBeenCalled()
  },
}
