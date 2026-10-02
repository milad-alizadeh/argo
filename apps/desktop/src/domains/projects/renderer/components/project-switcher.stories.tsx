import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSwitcher } from './project-switcher'

function ProjectSwitcherStory() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/storybook-project/sessions']}>
        <ProjectSwitcher />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Features/Projects/Project Switcher',
  component: ProjectSwitcherStory,
} satisfies Meta<typeof ProjectSwitcherStory>

export default meta
type Story = StoryObj<typeof ProjectSwitcherStory>

export const ProjectActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const menu = within(canvasElement.ownerDocument.body)
    const currentProject = (name: string) =>
      canvas.getByRole('button', { name: `Current project: ${name}` })
    await waitFor(() => expect(currentProject('argo')).toBeEnabled())
    await userEvent.click(currentProject('argo'))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await expect(menu.getByRole('menuitem', { name: 'Switch to argo' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await userEvent.click(menu.getByRole('menuitem', { name: 'Switch to worktree' }))
    // The previous menu's closing animation leaves it briefly unclickable, still in the DOM.
    await waitFor(() => expect(menu.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(currentProject('worktree')).toBeEnabled())
    await userEvent.click(currentProject('worktree'))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await expect(menu.getByRole('menuitem', { name: 'Switch to worktree' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(menu.getByRole('menuitem', { name: 'Switch to argo' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(currentProject('worktree')).toHaveFocus())
    await waitFor(() => expect(menu.queryByRole('menu')).toBeNull())
    await userEvent.click(currentProject('worktree'))
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Add project' }))
    await waitFor(() => expect(menu.queryByRole('menu')).toBeNull())
  },
}

export const OpensProjectSettings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const menu = within(canvasElement.ownerDocument.body)
    const currentProject = () => canvas.getByRole('button', { name: /^Current project:/ })
    await waitFor(() => expect(currentProject()).toBeEnabled())
    await userEvent.click(currentProject())
    await waitFor(() => expect(menu.getByText('Switch project')).toBeInTheDocument())
    await userEvent.click(menu.getByRole('menuitem', { name: 'Project settings…' }))
    await expect(await menu.findByRole('heading', { name: 'Project settings' })).toBeInTheDocument()
  },
}
