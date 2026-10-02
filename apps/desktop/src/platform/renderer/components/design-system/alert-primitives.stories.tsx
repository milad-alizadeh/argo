import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Icon } from '../icon/icon'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'

const meta = {
  title: 'Foundations/Primitives/Alert',
  component: Alert,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    variant: 'default',
  },
} satisfies Meta<typeof Alert>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Alert {...args}>
      <Icon name="info" size="primitive" />
      <AlertTitle>Account connection</AlertTitle>
      <AlertDescription>Connect an Account to read Tickets.</AlertDescription>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert')
    await expect(alert).toHaveTextContent('Account connection')
    await expect(alert).toHaveTextContent('Connect an Account to read Tickets.')
  },
}

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => (
    <Alert {...args}>
      <Icon name="triangle-alert" size="primitive" />
      <AlertTitle>The connection failed</AlertTitle>
      <AlertDescription>Sign in again to restore access.</AlertDescription>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Sign in again to restore access.',
    )
  },
}

const retry = fn()
export const Action: Story = {
  beforeEach: () => {
    retry.mockClear()
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Retry the connection</AlertTitle>
      <AlertDescription>The provider is available again.</AlertDescription>
      <AlertAction>
        <Button onClick={retry} size="xs">
          Retry
        </Button>
      </AlertAction>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(retry).toHaveBeenCalledOnce()
  },
}
