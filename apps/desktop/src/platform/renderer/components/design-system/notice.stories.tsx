import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRef } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '../ui/button'
import { Notice } from './notice'

const noticeRef = createRef<HTMLDivElement>()
const meta = {
  title: 'Design System/Patterns/Notice',
  component: Notice,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    tone: 'neutral',
    icon: 'info',
    heading: 'Account connection',
    children: 'Connect an Account to read Tickets.',
  },
} satisfies Meta<typeof Notice>
export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {
  args: { id: 'account-notice', title: 'Account notice', 'aria-label': 'Account notice' },
  render: (args) => <Notice {...args} ref={noticeRef} />,
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert', { name: 'Account notice' })
    await expect(alert).toHaveTextContent('Connect an Account to read Tickets.')
    await expect(alert).toHaveAttribute('id', 'account-notice')
    await expect(alert).toHaveAttribute('title', 'Account notice')
    await expect(noticeRef.current).toBe(alert)
  },
}

export const Success: Story = {
  args: {
    tone: 'success',
    icon: 'success',
    heading: 'Account connected',
    children: 'Argo can read Tickets through this Account.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Account connected')
  },
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    icon: 'warning',
    heading: 'Sign-in expires soon',
    children: 'Reconnect the Account before it expires.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Reconnect the Account before it expires.',
    )
  },
}

export const Danger: Story = {
  args: {
    tone: 'danger',
    icon: 'triangle-alert',
    heading: 'Access is unavailable',
    children: 'Reconnect this Account to read Tickets again.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Reconnect this Account to read Tickets again.',
    )
  },
}

const longError =
  'Argo could not reconnect the Ticket source because the provider refused the stored sign-in. The Project and its Tickets remain available in the local view. Connect the Account again, then retry the connection. If access is still unavailable, ask the repository owner to confirm that the Account can read Issues in this repository.'
export const LongError: Story = {
  args: {
    tone: 'danger',
    icon: 'triangle-alert',
    heading: 'The Ticket source could not reconnect',
  },
  render: (args) => (
    <Notice {...args}>
      <p>{longError}</p>
      <a href="https://github.com/organizations/analytical-engine/repositories/a-very-long-project-name-with-provider-connection-and-account-recovery-details">
        Review repository access
      </a>
    </Notice>
  ),
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert')
    await expect(alert).toHaveTextContent(longError)
    const recoveryLink = within(alert).getByRole('link', { name: 'Review repository access' })
    await expect(recoveryLink).toBeVisible()
    await userEvent.tab()
    await expect(recoveryLink).toHaveFocus()
  },
}

const retryConnection = fn()
function RecoverableNotice() {
  return (
    <Notice tone="warning" icon="warning" heading="The provider did not respond">
      <p>Retry the connection when the provider is available.</p>
      <Button onClick={retryConnection} size="sm">
        Retry connection
      </Button>
    </Notice>
  )
}

export const RecoveryAction: Story = {
  beforeEach: () => {
    retryConnection.mockClear()
  },
  render: () => <RecoverableNotice />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Retry connection' }))
    await expect(retryConnection).toHaveBeenCalledOnce()
  },
}

const disabledRetry = fn()
export const DisabledAction: Story = {
  beforeEach: () => {
    disabledRetry.mockClear()
  },
  render: () => (
    <Notice tone="neutral" icon="info" heading="Reconnecting the Account">
      <p>Wait while Argo reconnects this Account.</p>
      <Button disabled onClick={disabledRetry} size="sm">
        Retry connection
      </Button>
    </Notice>
  ),
  play: async ({ canvasElement }) => {
    const retry = within(canvasElement).getByRole('button', { name: 'Retry connection' })
    await expect(retry).toBeDisabled()
    await userEvent.click(retry, { pointerEventsCheck: 0 })
    await expect(disabledRetry).not.toHaveBeenCalled()
  },
}
