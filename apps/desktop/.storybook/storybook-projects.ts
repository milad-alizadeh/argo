import type { ProjectClient } from '../src/domains/projects/preload/client'

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
  beginProjectSetup: ({ projectId }) =>
    Promise.resolve({
      version: 1,
      type: 'project.setup.editing' as const,
      requestId: 'storybook-setup',
      project: { id: projectId, name: 'argo' },
      source: '',
    }),
  saveProjectSetup: ({ projectId, source }) =>
    Promise.resolve({
      version: 1,
      type: 'project.setup.editing' as const,
      requestId: 'storybook-setup',
      project: { id: projectId, name: 'argo' },
      source,
    }),
  validateProjectSetup: ({ projectId }) =>
    Promise.resolve({
      version: 1,
      type: 'project.setup.validated' as const,
      requestId: 'storybook-setup',
      project: { id: projectId, name: 'argo' },
      valid: true,
    }),
  cancelProjectSetup: ({ projectId }) =>
    Promise.resolve({
      version: 1,
      type: 'project.setup.cancelled' as const,
      requestId: 'storybook-setup',
      project: { id: projectId, name: 'argo' },
    }),
  registerProject: () => Promise.resolve(listed('storybook-worktree')),
  relocateProject: () => Promise.resolve(listed('storybook-worktree')),
  selectProject: ({ projectId }) => Promise.resolve(listed(projectId)),
}
