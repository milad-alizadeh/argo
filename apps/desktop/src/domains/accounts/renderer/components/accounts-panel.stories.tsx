import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { type AccountSummary, accountError } from '@/domains/accounts/contract/contract'
import {
  AccountsPanel,
  type AccountsPanelProps,
} from '@/domains/accounts/renderer/components/accounts-dialog'
import { ConnectSourceFields } from '@/domains/tickets/renderer/connection/connect-source-form'
import { ada, octocat } from '@/domains/tickets/renderer/detail/ticket-fixtures'
import { i18n } from '@/platform/renderer/i18n/i18n'

const idle: AccountsPanelProps['signIn'] = {
  phase: 'idle',
  provider: null,
  challenge: null,
  connected: null,
  error: null,
  start: fn(),
  openProvider: fn(),
  cancel: fn(),
}

const PROVIDERS = ['github', 'linear'] as const
const listing = (accounts: AccountSummary[]) => ({
  accounts,
  notice: false,
  providers: [...PROVIDERS],
})

const connected = {
  ...octocat,
  connections: [{ projectId: 'argo', projectName: 'argo', label: 'octocat/hello-world' }],
}
const revoked = { ...octocat, id: 'github:1', login: 'hubot', state: 'revoked' as const }

const meta: Meta<typeof AccountsPanel> = {
  title: 'Accounts/Accounts Panel',
  component: AccountsPanel,
  // The panel lives in a `sm:max-w-md` dialog, so the story draws it at that width.
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    listing: listing([connected, revoked]),
    listError: null,
    signIn: idle,
    disconnecting: null,
    disconnectError: null,
    onDisconnect: fn(),
  } satisfies AccountsPanelProps,
}

export default meta
type Story = StoryObj<typeof AccountsPanel>

export const Accounts: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('listitem', { name: 'GitHub Account octocat' })
    const connections = within(row).getByRole('list', { name: 'Repositories for octocat' })
    await expect(connections).toHaveTextContent('argo · octocat/hello-world')
    const disconnect = within(row).getByRole('button', { name: 'Disconnect…' })
    await expect(disconnect).toHaveStyle({ fontSize: '13px', lineHeight: '19px' })
    await userEvent.click(disconnect)
    // Asking lands on the harmless answer, and answering puts focus back on the row.
    await expect(within(row).getByRole('button', { name: 'Keep' })).toHaveFocus()
    await userEvent.click(within(row).getByRole('button', { name: 'Keep' }))
    await expect(within(row).getByRole('button', { name: 'Disconnect…' })).toHaveFocus()
    await expect(args.onDisconnect).not.toHaveBeenCalled()
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect' }))
    await expect(args.onDisconnect).toHaveBeenCalledWith('github:583231')
    const revokedRow = canvas.getByRole('listitem', { name: 'GitHub Account hubot' })
    await expect(revokedRow).toHaveTextContent('Access revoked')
    await expect(revokedRow).toHaveTextContent('No Project reads Tickets through this Account.')
    await userEvent.click(within(revokedRow).getByRole('button', { name: 'Reconnect' }))
    await expect(args.signIn.start).toHaveBeenCalledWith('github')
    // One button per provider this build can sign in to.
    await expect(canvas.getByRole('button', { name: 'Connect a Linear Account' })).toBeEnabled()
  },
}

// A Linear Account names its workspace, and an expired sign-in reconnects through Linear.
export const LinearExpired: Story = {
  args: {
    listing: listing([
      {
        ...ada,
        state: 'expired',
        connections: [{ projectId: 'argo', projectName: 'argo', label: 'Engine' }],
      },
    ]),
  },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', {
      name: 'Linear Account ada@analytical.dev',
    })
    await expect(row).toHaveTextContent('Analytical')
    await expect(row).toHaveTextContent('Sign-in expired')
    await expect(
      within(row).getByRole('list', { name: 'Teams for ada@analytical.dev' }),
    ).toHaveTextContent('argo · Engine')
    await userEvent.click(within(row).getByRole('button', { name: 'Reconnect' }))
    await expect(args.signIn.start).toHaveBeenCalledWith('linear')
  },
}

export const EnterCode: Story = {
  args: {
    signIn: {
      ...idle,
      phase: 'waiting',
      provider: 'github',
      challenge: {
        version: 1,
        type: 'account.challenge',
        requestId: 'request-1',
        provider: 'github',
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
    await expect(args.signIn.openProvider).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.signIn.cancel).toHaveBeenCalled()
  },
}

// Linear asks only for consent in the browser, so there is no code to copy.
export const AllowInLinear: Story = {
  args: {
    signIn: {
      ...idle,
      phase: 'waiting',
      provider: 'linear',
      challenge: {
        version: 1,
        type: 'account.challenge',
        requestId: 'request-1',
        provider: 'linear',
        expiresAt: 0,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Waiting for Linear…')).toHaveAttribute('role', 'status')
    await expect(canvas.queryByRole('status', { name: 'GitHub code' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Open Linear again' }))
    await expect(args.signIn.openProvider).toHaveBeenCalled()
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
      canvas.getByText('The sign-in expired before it was finished. Start again.'),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Connect a GitHub Account' })).toBeEnabled()
  },
}

export const NoAccounts: Story = {
  args: { listing: listing([]) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No Account is connected.')).toBeInTheDocument()
  },
}

// The repository-connect form draws inline once the caller passes it (#2411).
export const NoTicketConnection: Story = {
  args: {
    listing: listing([octocat]),
    connect: (
      <ConnectSourceFields
        accountId={octocat.id}
        accounts={[octocat]}
        error={null}
        onConnectSource={fn()}
        onSelectAccount={fn()}
        pending={false}
        sources={{ state: 'listed', scopes: [] }}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('listitem', { name: 'GitHub Account octocat' })).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: 'Account' })).toHaveTextContent(
      'GitHub · octocat',
    )
    await expect(canvas.getByRole('combobox', { name: 'Repository' })).toBeVisible()
  },
}

export const UnreadableSignIn: Story = {
  args: { listing: listing([{ ...connected, state: 'unreadable' }]) },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account octocat' })
    await expect(row).toHaveTextContent('Sign-in unreadable')
    await expect(row).toHaveTextContent('argo · octocat/hello-world')
    await userEvent.click(within(row).getByRole('button', { name: 'Reconnect' }))
    await expect(args.signIn.start).toHaveBeenCalled()
  },
}

export const AddedNewAccount: Story = {
  args: {
    signIn: { ...idle, phase: 'connected', connected: { login: 'octocat', outcome: 'added' } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Connected octocat.')
  },
}

export const RequestingCode: Story = {
  args: { signIn: { ...idle, phase: 'requesting', provider: 'github' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Asking GitHub for a code…' })
    await expect(button).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Connect a Linear Account' })).toBeDisabled()
  },
}

export const DisconnectInProgress: Story = {
  args: { disconnecting: octocat.id },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account octocat' })
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    await expect(within(row).getByRole('button', { name: 'Disconnect' })).toBeDisabled()
    await expect(within(row).getByRole('button', { name: 'Keep' })).toBeDisabled()
  },
}

const SIGN_IN_EXPIRED_TEXT = 'The sign-in expired before it was finished. Start again.'

export const DisconnectFailed: Story = {
  args: { disconnectError: accountError('sign-in-expired', 'request-1') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(SIGN_IN_EXPIRED_TEXT)).toBeInTheDocument()
  },
}

export const ListFailed: Story = {
  args: { listing: listing([]), listError: accountError('sign-in-expired', 'request-1') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(SIGN_IN_EXPIRED_TEXT)).toBeInTheDocument()
  },
}

// The disconnect question counts the Connections it would stop, so both plural forms are drawn.
export const DisconnectManyConnections: Story = {
  args: {
    listing: listing([
      {
        ...octocat,
        connections: [
          { projectId: 'argo', projectName: 'argo', label: 'octocat/hello-world' },
          { projectId: 'atlas', projectName: 'atlas', label: 'octocat/atlas' },
        ],
      },
    ]),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem', { name: 'GitHub Account octocat' })
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    await expect(row).toHaveTextContent(
      'Disconnect octocat? Its 2 repositories stop reading Tickets until you connect it again.',
    )
  },
}

// A language with no catalog of its own falls back to English, so the stub proves the switch: the
// one key it holds is drawn from the stub and the rest stay English (#2130).
const STUB_LANGUAGE = 'zz'
const STUB_EMPTY = 'STUB no Account'

export const StubLanguage: Story = {
  args: { listing: listing([]) },
  beforeEach: async () => {
    i18n.addResourceBundle(STUB_LANGUAGE, 'accounts', { list: { empty: STUB_EMPTY } })
    await i18n.changeLanguage(STUB_LANGUAGE)
    return async () => {
      i18n.removeResourceBundle(STUB_LANGUAGE, 'accounts')
      await i18n.changeLanguage('en')
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(STUB_EMPTY)).toBeInTheDocument()
    // Untranslated copy still reads in English rather than showing its key.
    await expect(canvas.getByRole('button', { name: 'Connect a GitHub Account' })).toBeEnabled()
  },
}

export const ReadingAccounts: Story = {
  args: { listing: null, listError: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Reading Accounts…')).toHaveAttribute(
      'role',
      'status',
    )
  },
}
