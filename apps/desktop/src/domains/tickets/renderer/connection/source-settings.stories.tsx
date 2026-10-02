import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { ticketError } from '@/domains/tickets/api/errors'
import { connection } from '@/mocks/tickets/renderer-models'
import { SourceSettings, type SourceSettingsProps } from './source-settings'

const meta = {
  title: 'Features/Tickets/Connection/Source Settings',
  component: SourceSettings,
  decorators: [
    (Story) => (
      <div className="max-w-md p-(--spacing-shell-inset)">
        <Story />
      </div>
    ),
  ],
  args: { disconnecting: false, error: null, onConnect: fn(), onDisconnect: fn() },
} satisfies Meta<typeof SourceSettings>

export default meta
type Story = StoryObj<typeof SourceSettings>

export const Connected: Story = {
  args: { connection: connection('github') },
  play: async ({ args, canvasElement }) => {
    const section = within(canvasElement).getByRole('region', { name: 'Ticket source' })
    await expect(section).toHaveTextContent('octocat/hello-world')
    await expect(section).toHaveTextContent('Read through GitHub · octocatConnected')
    await userEvent.click(within(section).getByRole('button', { name: 'Disconnect repository' }))
    await expect(args.onDisconnect).toHaveBeenCalled()
  },
}

// A Linear team shows its name, not its id, and an expired sign-in says so beside it.
export const LinearExpired: Story = {
  args: { connection: connection('linear', 'account-expired') },
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole('region', { name: 'Ticket source' })
    await expect(section).toHaveTextContent('Engine')
    await expect(section).not.toHaveTextContent('team-engine')
    await expect(section).toHaveTextContent(
      'Read through Linear · ada@analytical.devSign-in expired',
    )
    await expect(within(section).getByRole('button', { name: 'Disconnect team' })).toBeEnabled()
  },
}

export const NotConnected: Story = {
  args: { connection: null },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Ticket source connected')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a Ticket source' }))
    await expect(args.onConnect).toHaveBeenCalled()
  },
}

export const Loading: Story = {
  args: { connection: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Reading the connected Ticket source…'),
    ).toBeInTheDocument()
  },
}

export const LoadFailed: Story = {
  args: { connection: null, error: ticketError('not-connected', 'request-1') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'This Project has no connected Ticket source.',
    )
  },
}

export const Disconnecting: Story = {
  args: { connection: connection('github'), disconnecting: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Disconnect repository' })
    await expect(button).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    await expect(args.onDisconnect).not.toHaveBeenCalled()
  },
}

export const DisconnectFailure: Story = {
  args: {
    connection: connection('github'),
    error: ticketError('storage-not-written', 'notice-source'),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Argo could not save the connected Ticket source.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Disconnect repository' }))
    await expect(args.onDisconnect).toHaveBeenCalledOnce()
  },
}

function RecoverSource(props: SourceSettingsProps) {
  const [recovered, setRecovered] = useState(false)
  return (
    <SourceSettings
      {...props}
      connection={recovered ? connection('github') : null}
      error={recovered ? null : props.error}
      onConnect={() => {
        props.onConnect()
        setRecovered(true)
      }}
    />
  )
}

export const Recovery: Story = {
  args: { connection: null, error: ticketError('not-connected', 'notice-source') },
  render: (args) => <RecoverSource {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a Ticket source' }))
    await expect(args.onConnect).toHaveBeenCalledOnce()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.getByText('octocat/hello-world')).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Disconnect repository' })).toHaveFocus(),
    )
  },
}
