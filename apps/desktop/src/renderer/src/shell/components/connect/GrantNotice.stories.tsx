import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GrantNotice } from './GrantNotice'

const meta = {
  title: 'Shell/ConnectPanel/GrantNotice',
  component: GrantNotice,
  args: { onReconnect: fn(), onContinueOffline: fn() },
} satisfies Meta<typeof GrantNotice>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A sign-in GitHub has stopped accepting.
 *
 * Both ways out sit here, on the panel the failure points at: there is no separate connections
 * screen to hunt for. Continuing offline is a real answer rather than a dismissal.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const notice = within(canvasElement)
    await userEvent.click(notice.getByRole('button', { name: 'Reconnect' }))
    await expect(args.onReconnect).toHaveBeenCalled()
    await userEvent.click(notice.getByRole('button', { name: 'Continue offline' }))
    await expect(args.onContinueOffline).toHaveBeenCalled()
  },
}
