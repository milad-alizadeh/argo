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

const workspaces = [
  {
    id: 'storybook-workspace-main',
    kind: 'main' as const,
    displayName: 'Main checkout',
    path: '/storybook/argo',
    facts: { branch: 'main', headSha: 'storybook-sha', dirty: false },
  },
]

function workspacesListed(selectedId: string | null) {
  return {
    version: 1 as const,
    type: 'project.workspace.listed' as const,
    requestId: 'storybook-workspaces',
    workspaces,
    selectedId,
  }
}

function setupSnapshot(projectId: string) {
  return {
    version: 1 as const,
    type: 'project.setup.snapshot' as const,
    requestId: 'storybook-setup',
    projectId,
    revision: 0,
    screen: 'choosing-method' as const,
    manualSource: '',
    attempt: null,
    questions: [],
    plan: null,
    acceptedPlan: null,
    progress: [],
    finalDiff: null,
    activeEffect: null,
    recoveryMessage: null,
    pendingApproval: null,
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
  projectSetupSnapshot: ({ projectId }) => Promise.resolve(setupSnapshot(projectId)),
  sendProjectSetupCommand: ({ projectId }) => Promise.resolve(setupSnapshot(projectId)),
  subscribeProjectSetup: () => () => {},
  registerProject: () => Promise.resolve(listed('storybook-worktree')),
  relocateProject: () => Promise.resolve(listed('storybook-worktree')),
  selectProject: ({ projectId }) => Promise.resolve(listed(projectId)),
  listProjectWorkspaces: () => Promise.resolve(workspacesListed('storybook-workspace-main')),
  selectProjectWorkspace: ({ workspaceId }) => Promise.resolve(workspacesListed(workspaceId)),
  createManagedProjectWorkspace: () =>
    Promise.resolve(workspacesListed('storybook-workspace-main')),
}
