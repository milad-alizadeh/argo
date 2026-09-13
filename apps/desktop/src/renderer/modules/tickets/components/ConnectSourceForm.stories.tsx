import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ticketError } from '@/core/tickets/contract'
import { ConnectSourceForm, type ConnectSourceFormProps } from './ConnectSourceForm'
import { ada, octocat } from './ticket-fixtures'

const hubot = { ...octocat, id: 'github:1', login: 'hubot' }
const repository = (scope: string) => ({ scope, label: scope })

const meta: Meta<typeof ConnectSourceForm> = {
  title: 'Tickets/Connect Source Form',
  component: ConnectSourceForm,
  args: {
    projectName: 'argo',
    accounts: [octocat, { ...hubot, state: 'revoked' }],
    accountId: octocat.id,
    sources: {
      state: 'listed',
      scopes: ['hubot/arm', 'octocat/hello-world', 'octocat/spoon-knife'].map(repository),
    },
    pending: false,
    error: null,
    onSelectAccount: fn(),
    onConnectSource: fn(),
    onConnectAccount: fn(),
  } satisfies ConnectSourceFormProps,
}

export default meta
type Story = StoryObj<typeof ConnectSourceForm>

// The option list opens in a portal, outside the story's canvas.
const page = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

const optionNames = (canvasElement: HTMLElement) =>
  page(canvasElement)
    .queryAllByRole('option')
    .map((option) => option.textContent)

export const ConnectRepository: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const submit = canvas.getByRole('button', { name: 'Connect repository' })
    // A revoked Account cannot validate a repository, so it is not offered.
    await expect(canvas.getByRole('combobox', { name: 'Account' })).toHaveTextContent(
      'GitHub · octocat',
    )
    await expect(canvas.queryByRole('option', { name: 'GitHub · hubot' })).toBeNull()
    await userEvent.click(submit)
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).toHaveAccessibleDescription('Choose a repository.')
    await userEvent.type(repository, 'SPOON')
    await expect(optionNames(canvasElement)).toEqual(['octocat/spoon-knife'])
    await userEvent.clear(repository)
    await userEvent.type(repository, 'octocat/')
    await expect(optionNames(canvasElement)).toEqual(['octocat/hello-world', 'octocat/spoon-knife'])
    await userEvent.click(page(canvasElement).getByRole('option', { name: 'octocat/hello-world' }))
    await expect(repository).toHaveValue('octocat/hello-world')
    await userEvent.click(submit)
    await expect(args.onConnectSource).toHaveBeenCalledWith({
      accountId: 'github:583231',
      scope: 'octocat/hello-world',
    })
  },
}

export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('combobox', { name: 'Repository' }), 'nothing-here')
    await expect(optionNames(canvasElement)).toEqual([])
    await expect(page(canvasElement).getByText('No repository matches.')).toBeVisible()
  },
}

// The list button is for the pointer: the arrow keys open the list from the field itself.
export const KeyboardOrder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Repository' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Connect repository' })).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Show repositories' })).toBeVisible()
  },
}

export const SwitchAccount: Story = {
  args: { accounts: [octocat, hubot] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Connect repository' }))
    const account = canvas.getByRole('combobox', { name: 'Account' })
    await expect(account).toHaveTextContent('GitHub · octocat')
    await userEvent.click(account)
    // The list draws in a portal outside the canvas.
    const choices = await within(canvasElement.ownerDocument.body).findByRole('listbox')
    await userEvent.click(within(choices).getByRole('option', { name: 'GitHub · hubot' }))
    await expect(args.onSelectAccount).toHaveBeenCalledWith('github:1')
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).not.toHaveAttribute('aria-invalid')
    await expect(canvas.queryByText('Choose a repository.')).toBeNull()
  },
}

export const ReadingRepositories: Story = {
  args: { sources: { state: 'loading' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).toBeDisabled()
    await expect(repository).toHaveAccessibleDescription(
      'Reading the repositories octocat can see…',
    )
    await expect(canvas.getByRole('button', { name: 'Connect repository' })).toBeDisabled()
  },
}

export const NoRepositories: Story = {
  args: { sources: { state: 'listed', scopes: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).toBeDisabled()
    await expect(repository).toHaveAccessibleDescription(
      'octocat cannot see any repository with GitHub Issues turned on.',
    )
    await expect(canvas.getByRole('button', { name: 'Connect repository' })).toBeDisabled()
  },
}

export const RepositoriesUnreadable: Story = {
  args: {
    sources: { state: 'failed', message: 'Argo cannot reach GitHub.', onRetry: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).toBeDisabled()
    await expect(repository).toHaveAccessibleDescription('Argo cannot reach GitHub.')
    await userEvent.click(canvas.getByRole('button', { name: 'Read repositories again' }))
    const { sources } = args
    if (sources.state !== 'failed') throw new Error('The story reads a failed discovery')
    await expect(sources.onRetry).toHaveBeenCalled()
  },
}

export const Checking: Story = {
  args: { pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Checking the repository…' })).toBeDisabled()
  },
}

export const RepositoryRefused: Story = {
  args: { error: ticketError('repository-not-visible', 'request-1') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const repository = canvas.getByRole('combobox', { name: 'Repository' })
    await expect(repository).toHaveAttribute('aria-invalid', 'true')
    await expect(repository).toHaveAccessibleDescription(
      'This GitHub Account cannot see that repository.',
    )
  },
}

export const NoAccount: Story = {
  args: { accounts: [{ ...octocat, state: 'revoked' }] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Connect an Account to read Tickets')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect an Account' }))
    await expect(args.onConnectAccount).toHaveBeenCalled()
  },
}

// A Linear Account offers its teams by name and connects the team's id.
export const ConnectTeam: Story = {
  args: {
    accounts: [octocat, ada],
    accountId: ada.id,
    sources: { state: 'listed', scopes: [{ scope: 'team-engine', label: 'Engine' }] },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Connect argo to a team' })).toBeVisible()
    await expect(canvas.getByText(/open Linear issues/)).toBeVisible()
    const team = canvas.getByRole('combobox', { name: 'Team' })
    await userEvent.type(team, 'eng')
    await expect(optionNames(canvasElement)).toEqual(['Engine'])
    await userEvent.click(page(canvasElement).getByRole('option', { name: 'Engine' }))
    await expect(team).toHaveValue('Engine')
    await userEvent.click(canvas.getByRole('button', { name: 'Connect team' }))
    await expect(args.onConnectSource).toHaveBeenCalledWith({
      accountId: 'linear:user-ada',
      scope: 'team-engine',
    })
  },
}
