import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ticketError } from '@/domains/tickets/api/errors'
import { connection } from '@/mocks/tickets/renderer-models'
import { Button } from '@/platform/renderer/components/ui/button'
import type { ProjectSummary } from '../hooks'
import { ProjectSettingsDialog } from './project-settings-dialog'

const project = {
  id: 'storybook-project',
  name: 'Argo',
  path: `/workspace/${'nested-project-directory/'.repeat(12)}argo`,
} satisfies ProjectSummary

function ProjectSettingsStory() {
  const [open, setOpen] = useState(false)
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/storybook-project/sessions']}>
        <main>
          <Button onClick={() => setOpen(true)}>Project settings</Button>
          <ProjectSettingsDialog onOpenChange={setOpen} open={open} project={project} />
        </main>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Features/Projects/Project Settings Dialog',
  component: ProjectSettingsStory,
} satisfies Meta<typeof ProjectSettingsStory>

export default meta
type Story = StoryObj<typeof ProjectSettingsStory>

let releaseDisconnectFailure: (() => void) | null = null

function holdDisconnectFailure() {
  const previous = window.argo
  releaseDisconnectFailure = null
  window.argo = {
    ...previous,
    trpc: async (request) => {
      if (request.path === 'ticketConnection') {
        return {
          id: request.id,
          result: {
            data: {
              version: 1,
              type: 'ticket.connected',
              requestId: `storybook-${request.id}`,
              projectId: project.id,
              connection: connection('github'),
            },
          },
        }
      }
      if (request.path === 'ticketDisconnect') {
        await new Promise<void>((resolve) => {
          releaseDisconnectFailure = resolve
        })
        return {
          id: request.id,
          result: { data: ticketError('storage-not-written', `storybook-${request.id}`) },
        }
      }
      return previous.trpc(request)
    },
  }
  return () => {
    releaseDisconnectFailure?.()
    releaseDisconnectFailure = null
    window.argo = previous
  }
}

async function exerciseDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Project settings' })
  await userEvent.click(trigger)
  const dialog = await within(document.body).findByRole('dialog', { name: 'Project settings' })
  await waitFor(() => expect(dialog).toBeVisible())
  const path = within(dialog).getByText(project.path)
  await expect(path).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
}

export const LongProjectPath: Story = {
  render: () => <ProjectSettingsStory />,
  play: ({ canvasElement }) => exerciseDialog(canvasElement),
}

export const NarrowPopup: Story = {
  globals: { viewport: { value: 'compact', isRotated: false } },
  render: () => <ProjectSettingsStory />,
  play: ({ canvasElement }) => exerciseDialog(canvasElement),
}

export const DisconnectPendingAndFailed: Story = {
  render: () => <ProjectSettingsStory />,
  beforeEach: holdDisconnectFailure,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Project settings' })
    await userEvent.click(trigger)
    const dialog = await within(document.body).findByRole('dialog', { name: 'Project settings' })
    await waitFor(() => expect(dialog).toBeVisible())
    const disconnect = await within(dialog).findByRole('button', { name: 'Disconnect repository' })
    await userEvent.click(disconnect)
    await waitFor(() => expect(disconnect).toBeDisabled())
    releaseDisconnectFailure?.()
    const failure = await within(dialog).findByText(
      'Argo could not save the connected Ticket source.',
    )
    await waitFor(() => expect(failure).toBeVisible())
    await expect(dialog).toBeVisible()
    await expect(disconnect).toBeEnabled()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
