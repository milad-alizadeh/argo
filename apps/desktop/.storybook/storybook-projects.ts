import type {
  ProjectOpenReply,
  ProjectSetupCommand,
  ProjectSetupReply,
} from '../src/domains/projects/contract/contract'
import type { ProjectListReply } from '../src/domains/projects/contract/messages'
import type { ProjectError } from '../src/domains/projects/contract/project-error'
import type { ProjectWorkspaceListed } from '../src/domains/projects/contract/workspace-messages'

type ProjectWorkspaceReply = ProjectWorkspaceListed | ProjectError

type StorybookProjectBridge = {
  openProject: (request: { projectId: string }) => Promise<ProjectOpenReply>
  projectSetupSnapshot: (request: { projectId: string }) => Promise<ProjectSetupReply>
  sendProjectSetupCommand: (request: {
    projectId: string
    commandId: string
    expectedRevision: number
    command: ProjectSetupCommand
  }) => Promise<ProjectSetupReply>
  subscribeProjectSetup: (
    projectId: string,
    listener: (reply: ProjectSetupReply) => void,
  ) => () => void
  listProjects: () => Promise<ProjectListReply>
  registerProject: () => Promise<ProjectListReply>
  relocateProject: (request: { projectId: string }) => Promise<ProjectListReply>
  selectProject: (request: { projectId: string }) => Promise<ProjectListReply>
  listProjectWorkspaces: (request: { projectId: string }) => Promise<ProjectWorkspaceReply>
  selectProjectWorkspace: (request: {
    projectId: string
    workspaceId: string
  }) => Promise<ProjectWorkspaceReply>
  createManagedProjectWorkspace: (request: {
    projectId: string
    baseRef: string
  }) => Promise<ProjectWorkspaceReply>
}

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

export const storybookProjectBridge: StorybookProjectBridge = {
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
