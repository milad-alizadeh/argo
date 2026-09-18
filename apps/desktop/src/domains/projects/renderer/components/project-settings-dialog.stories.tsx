import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { connection } from '@/renderer/modules/tickets/components/ticket-fixtures'
import { ProjectSettingsDialog } from './project-settings-dialog'

const PROJECT: ProjectSummary = { id: 'project-1', name: 'argo', path: '/Users/milad/argo' }

// The dialog reads its own Connection through `window.argo.readConnection`, so a story stands
// one in for the read the way the Roster stories stand in for `listSessions`.
function withConnectionHost(handler: (request: { projectId: string }) => Promise<unknown>) {
  const before = window.argo
  window.argo = { ...before, readConnection: handler as typeof before.readConnection }
  return () => {
    window.argo = before
  }
}

const meta: Meta<typeof ProjectSettingsDialog> = {
  title: 'Projects/Project Settings Dialog',
  component: ProjectSettingsDialog,
  args: { project: PROJECT, open: true, onOpenChange: fn() },
}

export default meta
type Story = StoryObj<typeof ProjectSettingsDialog>

export const NoTicketSource: Story = {
  beforeEach: () =>
    withConnectionHost(async (request) => ({
      version: 1,
      type: 'ticket.connected',
      requestId: 'story',
      projectId: request.projectId,
      connection: null,
    })),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('heading', { name: 'Project settings' })).toBeInTheDocument()
    await expect(body.getByText('argo')).toBeInTheDocument()
    await expect(body.getByText('/Users/milad/argo')).toBeInTheDocument()
    await expect(await body.findByText('No Ticket source connected')).toBeInTheDocument()
  },
}

export const ConnectedSource: Story = {
  beforeEach: () =>
    withConnectionHost(async (request) => ({
      version: 1,
      type: 'ticket.connected',
      requestId: 'story',
      projectId: request.projectId,
      connection: connection('github'),
    })),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('octocat/hello-world')).toBeInTheDocument()
    await expect(body.getByRole('button', { name: 'Disconnect repository' })).toBeInTheDocument()
  },
}

export const NavigatesToConnect: Story = {
  beforeEach: () =>
    withConnectionHost(async (request) => ({
      version: 1,
      type: 'ticket.connected',
      requestId: 'story',
      projectId: request.projectId,
      connection: null,
    })),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const originalHash = window.location.hash
    try {
      await userEvent.click(await body.findByRole('button', { name: 'Connect a Ticket source' }))
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
      await expect(window.location.hash).toBe('#/tickets')
    } finally {
      window.location.hash = originalHash
    }
  },
}
