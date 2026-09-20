import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ProjectOnboarding } from '@/domains/projects/renderer/setup/project-onboarding'
import { SessionsSidebar } from '@/domains/sessions/renderer/components/roster/sessions-sidebar'
import { SELECTED_SESSION_KEY } from '@/domains/sessions/renderer/components/roster/use-sidebar-actions'
import { CockpitRouteLayout } from '@/platform/renderer/cockpit/routes/cockpit-router'

function CockpitRouteLayoutStory() {
  const [queryClient] = useState(() => new QueryClient())
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          element: <CockpitRouteLayout />,
          children: [
            { id: 'project-onboarding', path: '/projects/new', element: <ProjectOnboarding /> },
            {
              path: '/sessions',
              handle: { sidebar: <SessionsSidebar /> },
              // The sidebar reopens the last selected Session, so that path must resolve.
              children: [
                { index: true, element: null },
                { path: ':sessionId', element: null },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/sessions'] },
    ),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-dvh">
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof CockpitRouteLayoutStory> = {
  title: 'Cockpit/Route Layout',
  component: CockpitRouteLayoutStory,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof CockpitRouteLayoutStory>

const PROJECT = { id: 'story-project', name: 'argo', path: '/storybook/argo' }

function listed(projects: (typeof PROJECT)[], selectedId: string | null) {
  return {
    version: 1 as const,
    type: 'project.listed' as const,
    requestId: 'story-projects',
    projects,
    selectedId,
  }
}

// With no Project the cockpit has nothing to show a roster for: the window names the next step, and
// adding a Project from it opens the cockpit on that Project (#2307).
export const NoProject: Story = {
  beforeEach: () => {
    const before = window.argo
    const storedSession = window.localStorage.getItem(SELECTED_SESSION_KEY)
    window.localStorage.setItem(SELECTED_SESSION_KEY, 'restored-session')
    window.argo = {
      ...before,
      listProjects: () => Promise.resolve(listed([], null)),
      registerProject: () => Promise.resolve(listed([PROJECT], PROJECT.id)),
    }
    return () => {
      window.argo = before
      if (storedSession === null) window.localStorage.removeItem(SELECTED_SESSION_KEY)
      else window.localStorage.setItem(SELECTED_SESSION_KEY, storedSession)
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Add a Project to start')).toBeVisible()
    await expect(canvas.queryByRole('complementary', { name: 'Sessions sidebar' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'New Session' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Add Project…' }))
    await expect(await canvas.findByRole('main', { name: 'Project setup' })).toBeVisible()
    await expect(canvas.getByText('Choose a Project folder')).toBeVisible()
    await expect(canvas.queryByText('Add a Project to start')).toBeNull()
  },
}
