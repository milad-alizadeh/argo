import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { REGISTER_PROJECT_COMMAND } from '@/platform/shared/commands'
import { STORYBOOK_COMMAND_EVENT } from '../../../../../.storybook/storybook-commands'

function ProjectSwitcherStory() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectSwitcher />
    </QueryClientProvider>
  )
}

const meta: Meta<typeof ProjectSwitcherStory> = {
  title: 'Cockpit/Project Switcher',
  component: ProjectSwitcherStory,
}

export default meta
type Story = StoryObj<typeof ProjectSwitcherStory>

function dispatchProjectCommand(canvasElement: HTMLElement) {
  const view = canvasElement.ownerDocument.defaultView
  if (!view) return
  view.dispatchEvent(
    new view.CustomEvent(STORYBOOK_COMMAND_EVENT, { detail: REGISTER_PROJECT_COMMAND }),
  )
}

export const ProjectActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const menu = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: argo' })).toBeEnabled(),
    )
    dispatchProjectCommand(canvasElement)
    await waitFor(() => expect(window.location.hash).toBe('#/projects/new'))
    window.location.hash = ''
    await userEvent.click(canvas.getByRole('button', { name: 'Current project: argo' }))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Switch to argo' }))
    // The previous menu's closing animation leaves it briefly unclickable, still in the DOM.
    await waitFor(() => expect(menu.queryByRole('menu')).toBeNull())
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: argo' })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Current project: argo' }))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Add project' }))
    await waitFor(() => expect(window.location.hash).toBe('#/projects/new'))
  },
}

export const OpensProjectSettings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const menu = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: argo' })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Current project: argo' }))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Project settings…' }))
    await expect(await menu.findByRole('heading', { name: 'Project settings' })).toBeInTheDocument()
  },
}
