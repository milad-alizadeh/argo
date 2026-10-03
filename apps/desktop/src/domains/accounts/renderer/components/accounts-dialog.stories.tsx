import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { accountError } from '@/domains/accounts/contract/contract'
import { octocat } from '@/mocks/tickets/renderer-models'
import { Button } from '@/platform/renderer/components/ui/button'
import { QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { useAccountsDialog } from '../state'
import { AccountsDialog } from './accounts-dialog'

function AccountsDialogControls() {
  const { setOpen } = useAccountsDialog()
  return (
    <main>
      <Button onClick={() => setOpen(true)}>Manage accounts</Button>
      <AccountsDialog />
    </main>
  )
}

function AccountsDialogStory() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    queryClient.setQueryData(QUERY_KEYS.accounts, {
      accounts: Array.from({ length: 18 }, (_, index) => ({
        ...octocat(),
        id: `github:${index}`,
        login: `octocat-${index}`,
      })),
      notice: false,
      providers: ['github', 'linear'],
    })
    return queryClient
  })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/projects/storybook-project/tickets']}>
        <AccountsDialogControls />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Features/Accounts/Accounts Dialog',
  component: AccountsDialogStory,
} satisfies Meta<typeof AccountsDialogStory>

export default meta
type Story = StoryObj<typeof AccountsDialogStory>

let releaseDisconnect: (() => void) | null = null

function holdDisconnectFailure() {
  const previous = window.argo
  releaseDisconnect = null
  window.argo = {
    ...previous,
    trpc: async (request) => {
      if (request.path !== 'accountDisconnect') return previous.trpc(request)
      await new Promise<void>((resolve) => {
        releaseDisconnect = resolve
      })
      return {
        id: request.id,
        result: { data: accountError('storage-not-written', `storybook-${request.id}`) },
      }
    },
  }
  return () => {
    releaseDisconnect?.()
    releaseDisconnect = null
    window.argo = previous
  }
}

async function exerciseDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Manage accounts' })
  await userEvent.click(trigger)
  const dialog = await within(document.body).findByRole('dialog', { name: 'Accounts' })
  await waitFor(() => expect(dialog).toBeVisible())
  await expect(within(dialog).getByRole('list', { name: 'Accounts' })).toBeVisible()
  await expect(
    within(dialog).getByRole('listitem', { name: 'GitHub Account octocat-17' }),
  ).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
}

export const LongAccountList: Story = {
  render: () => <AccountsDialogStory />,
  play: ({ canvasElement }) => exerciseDialog(canvasElement),
}

export const NarrowPopup: Story = {
  globals: { viewport: { value: 'compact', isRotated: false } },
  render: () => <AccountsDialogStory />,
  play: ({ canvasElement }) => exerciseDialog(canvasElement),
}

export const DisconnectPendingAndFailed: Story = {
  render: () => <AccountsDialogStory />,
  beforeEach: holdDisconnectFailure,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Manage accounts' }))
    const dialog = await within(document.body).findByRole('dialog', { name: 'Accounts' })
    const row = within(dialog).getByRole('listitem', { name: 'GitHub Account octocat-0' })
    await userEvent.click(within(row).getByRole('button', { name: 'Disconnect…' }))
    const disconnect = within(row).getByRole('button', { name: 'Disconnect' })
    const keep = within(row).getByRole('button', { name: 'Keep' })
    await userEvent.click(disconnect)
    await waitFor(() => expect(disconnect).toBeDisabled())
    await expect(keep).toBeDisabled()
    releaseDisconnect?.()
    await expect(await within(dialog).findByText('Argo could not save the Account.')).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(keep).toBeEnabled()
    await userEvent.click(keep)
    await expect(within(row).getByRole('button', { name: 'Disconnect…' })).toHaveFocus()
  },
}
