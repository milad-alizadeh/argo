import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { octocat } from '@/mocks/tickets/renderer-models'
import { Button } from '@/platform/renderer/components/ui/button'
import { QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { AccountsDialog } from './accounts-dialog'
import { useAccountsDialog } from '../state'

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
  title: 'Accounts/Accounts Dialog',
  component: AccountsDialogStory,
} satisfies Meta<typeof AccountsDialogStory>

export default meta
type Story = StoryObj<typeof AccountsDialogStory>

async function exerciseDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Manage accounts' })
  await userEvent.click(trigger)
  const dialog = await within(document.body).findByRole('dialog', { name: 'Accounts' })
  await waitFor(() => expect(dialog).toBeVisible())
  await expect(within(dialog).getByRole('list', { name: 'Accounts' })).toBeVisible()
  const content = dialog
  expect(content.classList.contains('overflow-y-auto')).toBe(true)
  await waitFor(() => expect(content.scrollHeight).toBeGreaterThan(content.clientHeight))
  expect(content.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth)
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
