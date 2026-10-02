import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignInNotice } from './sign-in-notice'

const meta = {
  title: 'Features/Accounts/Sign In Notice',
  component: SignInNotice,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  args: { onConnect: fn(), onDismiss: fn() },
} satisfies Meta<typeof SignInNotice>
export default meta
type Story = StoryObj<typeof meta>

export const Actions: Story = {
  play: async ({ args, canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Sign-in notice' })
    await expect(region).toHaveTextContent('Sign-ins from the earlier Argo app do not carry over.')
    await expect(within(canvasElement).queryByRole('alert')).toBeNull()
    await userEvent.click(within(region).getByRole('button', { name: 'Connect an Account' }))
    await expect(args.onConnect).toHaveBeenCalledOnce()
    await userEvent.click(within(region).getByRole('button', { name: 'Dismiss' }))
    await expect(args.onDismiss).toHaveBeenCalledOnce()
  },
}
