import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Icon } from '../icon/icon'
import { Loader } from '../loader/loader'
import { Button } from '../ui/button'
import { EmptyState } from './empty-state'

const onAction = fn()
const meta = {
  title: 'Design System/Patterns/Empty State',
  component: EmptyState,
  args: { media: <Icon name="no-search-results" />, title: 'No matching projects' },
  decorators: [
    (Story) => (
      <div className="h-[32rem] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>

export const FullPane: Story = {
  args: { description: 'Try another name or clear the search.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'No matching projects', level: 2 }),
    ).toBeVisible()
    await expect(canvas.getByText('Try another name or clear the search.')).toBeVisible()
  },
}

export const CompactList: Story = {
  args: {
    size: 'compact',
    title: 'No Sessions found',
    media: <Icon name="messages-square" />,
    description: 'No Sessions match this search.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'No Sessions found', level: 2 })).toBeVisible()
    await expect(canvas.getByText('No Sessions match this search.')).toBeVisible()
  },
}

export const NoProject: Story = {
  args: {
    media: <Icon name="repository" />,
    title: 'No Project selected',
    description: 'Select a Project to see its Tickets.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'No Project selected', level: 2 }),
    ).toBeVisible()
    await expect(canvas.getByText('Select a Project to see its Tickets.')).toBeVisible()
  },
}

export const NoHarnessReady: Story = {
  args: {
    media: <Icon name="connect" />,
    title: 'Connect a Harness to continue',
    description: 'Sign in to a Harness before starting a Session.',
    action: <Button onClick={onAction}>Connect Claude</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Connect a Harness to continue' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect Claude' }))
    await expect(onAction).toHaveBeenCalledOnce()
  },
}

export const NoSessionSelected: Story = {
  args: {
    media: <Icon name="messages-square" />,
    title: 'No Session selected',
    description: 'Choose a Session to read its history.',
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'No Session selected' }),
    ).toBeVisible()
  },
}

export const NoTicketSelected: Story = {
  args: {
    media: <Icon name="ticket" />,
    title: 'No Ticket selected',
    description: 'Choose an open Ticket to inspect its details.',
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'No Ticket selected' }),
    ).toBeVisible()
  },
}

function RetryState() {
  const [loading, setLoading] = useState(false)
  return (
    <EmptyState
      action={
        <Button
          disabled={loading}
          onClick={() => {
            setLoading(true)
            onAction()
          }}
        >
          Try again
        </Button>
      }
      description={
        loading ? 'Retrying the Ticket provider now.' : 'Argo could not reach the Ticket provider.'
      }
      media={loading ? <Loader aria-hidden size="control" /> : <Icon name="retry" />}
      role={loading ? 'status' : 'alert'}
      title={loading ? 'Loading Tickets' : 'Tickets are unavailable'}
    />
  )
}

export const UnavailableRetryAndLoading: Story = {
  args: { media: <Icon name="retry" />, title: 'Tickets are unavailable' },
  render: () => <RetryState />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Tickets are unavailable')
    const retry = canvas.getByRole('button', { name: 'Try again' })
    retry.focus()
    await expect(retry).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(onAction).toHaveBeenCalled()
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading Tickets')
    await expect(canvas.getByRole('status')).toHaveTextContent('Retrying the Ticket provider now.')
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeDisabled()
  },
}

export const LongCopyInNarrowPane: Story = {
  args: {
    description:
      'A saved Ticket remains available in the backlog while its provider reconnects. '.repeat(4),
    media: <Icon name="ticket" />,
    title: 'The Ticket provider is temporarily unavailable',
  },
  decorators: [
    (Story) => (
      <div className="h-[32rem] w-72">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'The Ticket provider is temporarily unavailable' }),
    ).toBeVisible()
    await expect(canvas.getByText(/A saved Ticket remains available/)).toBeVisible()
  },
}
