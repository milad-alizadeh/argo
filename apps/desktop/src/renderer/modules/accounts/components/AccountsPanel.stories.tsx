import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { accountError } from '@/core/accounts/contract'
import { octocat } from '../../tickets/components/ticket-fixtures'
import { AccountsPanel, type AccountsPanelProps } from './AccountsDialog'
import type { SignInPanelProps } from './SignInPanel'

const idle: SignInPanelProps = {
  phase: 'idle',
  challenge: null,
  connected: null,
  error: null,
  start: fn(),
  openGitHub: fn(),
  cancel: fn(),
}

const bound = {
  ...octocat,
  bindings: [{ projectId: 'argo', projectName: 'argo', scope: 'octocat/hello-world' }],
}
const revoked = { ...octocat, id: 'github:1', login: 'hubot', state: 'revoked' as const }

const meta: Meta<typeof AccountsPanel> = {
  title: 'Accounts/Accounts panel',
  component: AccountsPanel,
  args: {
    listing: { accounts: [bound, revoked], notice: false },
    listError: null,
    signIn: idle,
    disconnecting: null,
    disconnectError: null,
    onDisconnect: fn(),
  } satisfies AccountsPanelProps,
}

export default meta
type Story = StoryObj<typeof AccountsPanel>

export const Disconnect: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('listitem', { name: 'GitHub Account octocat' })
    const bindings = within(row).getByRole('list', { name: 'Bindings for octocat' })
    await expect(bindings).toHaveTextContent('argo · octocat/hello-world')
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect' }))
    await expect(args.onDisconnect).toHaveBeenCalledWith('github:583231')
  },
}

export const KeepAccount: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account octocat' })
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    // Asking lands on the harmless answer, and answering puts focus back on the row.
    await expect(within(row).getByRole('button', { name: 'Keep' })).toHaveFocus()
    await userEvent.click(within(row).getByRole('button', { name: 'Keep' }))
    await expect(within(row).getByRole('button', { name: 'Disconnect…' })).toHaveFocus()
    await expect(args.onDisconnect).not.toHaveBeenCalled()
  },
}

export const RevokedAccount: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account hubot' })
    await expect(row).toHaveTextContent('Access revoked')
    await expect(row).toHaveTextContent('No Project is bound to this Account.')
    await userEvent.click(within(row).getByRole('button', { name: 'Reconnect' }))
    await expect(args.signIn.start).toHaveBeenCalled()
  },
}

export const EnterCode: Story = {
  args: {
    signIn: {
      ...idle,
      phase: 'code',
      challenge: {
        version: 1,
        type: 'account.challenge',
        requestId: 'request-1',
        userCode: 'WDJB-MJHT',
        verificationUri: 'https://github.com/login/device',
        expiresAt: 0,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Waiting for GitHub…')).toHaveAttribute('role', 'status')
    await expect(canvas.getByText('WDJB-MJHT')).toHaveAccessibleName('GitHub code')
    await userEvent.click(canvas.getByRole('button', { name: 'Copy code and open GitHub' }))
    await expect(args.signIn.openGitHub).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.signIn.cancel).toHaveBeenCalled()
  },
}

export const SignedInAgain: Story = {
  args: {
    signIn: { ...idle, phase: 'connected', connected: { login: 'octocat', outcome: 'renewed' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Signed in again as/)).toHaveTextContent(
      'Signed in again as octocat.',
    )
    await expect(canvas.getAllByRole('listitem', { name: /^GitHub Account/ })).toHaveLength(2)
  },
}

export const SignInFailed: Story = {
  args: { signIn: { ...idle, error: accountError('sign-in-expired', 'request-1') } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('The GitHub code expired before it was entered. Start again.'),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Connect a GitHub Account' })).toBeEnabled()
  },
}

export const NoAccounts: Story = {
  args: { listing: { accounts: [], notice: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No GitHub Account is connected.'),
    ).toBeInTheDocument()
  },
}

export const UnreadableSignIn: Story = {
  args: { listing: { accounts: [{ ...bound, state: 'unreadable' }], notice: false } },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account octocat' })
    await expect(row).toHaveTextContent('Sign-in unreadable')
    await expect(row).toHaveTextContent('argo · octocat/hello-world')
    await userEvent.click(within(row).getByRole('button', { name: 'Reconnect' }))
    await expect(args.signIn.start).toHaveBeenCalled()
  },
}
