import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ticketError } from '@/core/tickets/contract'
import { ConnectRepositoryForm, type ConnectRepositoryFormProps } from './ConnectRepositoryForm'
import { octocat } from './ticket-fixtures'

const meta: Meta<typeof ConnectRepositoryForm> = {
  title: 'Tickets/Connect Repository Form',
  component: ConnectRepositoryForm,
  args: {
    projectName: 'argo',
    accounts: [octocat, { ...octocat, id: 'github:1', login: 'hubot', state: 'revoked' }],
    pending: false,
    error: null,
    onConnectRepository: fn(),
    onConnectAccount: fn(),
  } satisfies ConnectRepositoryFormProps,
}

export default meta
type Story = StoryObj<typeof ConnectRepositoryForm>

export const ConnectRepository: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const submit = canvas.getByRole('button', { name: 'Connect repository' })
    await expect(submit).toBeEnabled()
    // A revoked Account cannot validate a repository, so it is not offered.
    await expect(canvas.getByRole('combobox', { name: 'GitHub Account' })).toHaveTextContent(
      'octocat',
    )
    await expect(canvas.queryByRole('option', { name: 'hubot' })).toBeNull()
    await userEvent.click(submit)
    await expect(canvas.getByRole('textbox', { name: 'Repository' })).toHaveAccessibleDescription(
      'Enter the GitHub repository as owner/name.',
    )
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Repository' }),
      ' octocat/hello-world ',
    )
    await userEvent.click(submit)
    await expect(args.onConnectRepository).toHaveBeenCalledWith({
      accountId: 'github:583231',
      scope: 'octocat/hello-world',
    })
  },
}

export const Checking: Story = {
  args: { pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Repository' }), 'octocat/hello-world')
    await expect(canvas.getByRole('button', { name: 'Checking the repository…' })).toBeDisabled()
  },
}

export const RepositoryRefused: Story = {
  args: { error: ticketError('repository-not-visible', 'request-1') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Repository' })
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription(
      'This GitHub Account cannot see that repository.',
    )
  },
}

export const NoAccount: Story = {
  args: { accounts: [{ ...octocat, state: 'revoked' }] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Connect GitHub to read Tickets')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect GitHub' }))
    await expect(args.onConnectAccount).toHaveBeenCalled()
  },
}
