import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { REGISTER_PROJECT_COMMAND } from '@/core/commands/shortcuts'
import { STORYBOOK_COMMAND_EVENT } from '../../../../../.storybook/storybook-commands'
import { ProjectSwitcher } from './ProjectSwitcher'

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
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: worktree' })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Current project: worktree' }))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Switch to argo' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: argo' })).toBeEnabled(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Current project: argo' }))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Add project' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Current project: worktree' })).toBeEnabled(),
    )
  },
}
