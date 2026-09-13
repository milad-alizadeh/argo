import type { ProjectClient } from '../src/core/projects/client'

const projects = [
  { id: 'storybook-project', name: 'argo', path: '/storybook/argo' },
  { id: 'storybook-worktree', name: 'worktree', path: '/storybook/worktree' },
]

function listed(selectedId: string) {
  return {
    version: 1 as const,
    type: 'project.listed' as const,
    requestId: 'storybook-projects',
    projects,
    selectedId,
  }
}

export const storybookProjectBridge: ProjectClient = {
  listProjects: () => Promise.resolve(listed('storybook-project')),
  openProject: () =>
    Promise.resolve({
      version: 1,
      type: 'project.opened' as const,
      requestId: 'storybook-project',
      project: { id: 'storybook-project', name: 'argo' },
    }),
  registerProject: () => Promise.resolve(listed('storybook-worktree')),
  relocateProject: () => Promise.resolve(listed('storybook-worktree')),
}
