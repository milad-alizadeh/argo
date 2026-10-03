import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { accountError } from '@/domains/accounts/contract/contract'
import { SignInPanel, type SignInPanelProps } from './sign-in-panel'

const deviceCode: NonNullable<SignInPanelProps['challenge']> = {
  version: 1,
  type: 'account.challenge',
  requestId: 'notice-sign-in',
  provider: 'github',
  kind: 'device-code',
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://github.com/login/device',
  expiresAt: 0,
}
const meta = {
  title: 'Features/Accounts/Sign In Panel',
  component: SignInPanel,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    providers: ['github', 'linear'],
    phase: 'idle',
    provider: null,
    challenge: null,
    connected: null,
    error: null,
    start: fn(),
    openProvider: fn(),
    cancel: fn(),
  },
} satisfies Meta<typeof SignInPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Connect a GitHub Account' })
    await userEvent.click(button)
    await expect(args.start).toHaveBeenCalledWith('github')
  },
}

export const Requesting: Story = {
  args: { phase: 'requesting', provider: 'github' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Asking GitHub for a code…' })
    await expect(button).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Connect a Linear Account' })).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    await expect(args.start).not.toHaveBeenCalled()
  },
}

export const DeviceCode: Story = {
  args: { phase: 'waiting', provider: 'github', challenge: deviceCode },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'GitHub code' })).toHaveTextContent('WDJB-MJHT')
    await expect(canvas.getByText('Waiting for GitHub…')).toHaveAttribute('role', 'status')
    await userEvent.click(canvas.getByRole('button', { name: 'Copy code and open GitHub' }))
    await expect(args.openProvider).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.cancel).toHaveBeenCalledOnce()
  },
}

export const BrowserConsent: Story = {
  args: {
    phase: 'waiting',
    provider: 'linear',
    challenge: {
      version: 1,
      type: 'account.challenge',
      requestId: 'notice-sign-in',
      provider: 'linear',
      kind: 'browser-consent',
      expiresAt: 0,
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('status', { name: 'GitHub code' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Open Linear again' }))
    await expect(args.openProvider).toHaveBeenCalledOnce()
  },
}

export const Failure: Story = {
  args: { error: accountError('sign-in-expired', 'notice-sign-in') },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'The sign-in expired before it was finished. Start again.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a GitHub Account' }))
    await expect(args.start).toHaveBeenCalledWith('github')
  },
}

function RetrySignIn(props: SignInPanelProps) {
  const [waiting, setWaiting] = useState(false)
  return (
    <SignInPanel
      {...props}
      phase={waiting ? 'waiting' : 'idle'}
      provider={waiting ? 'github' : null}
      challenge={waiting ? deviceCode : null}
      error={waiting ? null : props.error}
      start={(provider) => {
        props.start(provider)
        setWaiting(true)
      }}
    />
  )
}

export const RetryRecovery: Story = {
  args: { providers: ['github'], error: accountError('sign-in-expired', 'notice-sign-in') },
  render: (args) => <RetrySignIn {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a GitHub Account' }))
    await expect(args.start).toHaveBeenCalledWith('github')
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.getByRole('status', { name: 'GitHub code' })).toHaveTextContent('WDJB-MJHT')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Copy code and open GitHub' })).toHaveFocus(),
    )
  },
}

export const Connected: Story = {
  args: { phase: 'connected', connected: { login: 'octocat', outcome: 'added' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Connected octocat.')
  },
}
