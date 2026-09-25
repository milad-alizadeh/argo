import type {
  ProjectOpenReply,
  ProjectSetupCommand,
  ProjectSetupReply,
} from '../src/domains/projects/contract/contract'
import type { ProjectListReply } from '../src/domains/projects/contract/messages'
import type { ProjectError } from '../src/domains/projects/contract/project-error'
import type { ProjectWorkspaceListed } from '../src/domains/projects/contract/workspace-messages'

type ProjectWorkspaceReply = ProjectWorkspaceListed | ProjectError

type StorybookProjectProcedures = {
  projectOpen: (request: { projectId: string }) => Promise<ProjectOpenReply>
  projectSetupSnapshot: (request: { projectId: string }) => Promise<ProjectSetupReply>
  projectSetupCommand: (request: {
    projectId: string
    commandId: string
    expectedRevision: number
    command: ProjectSetupCommand
  }) => Promise<ProjectSetupReply>
  projectList: () => Promise<ProjectListReply>
  projectRegister: () => Promise<ProjectListReply>
  projectRelocate: (request: { projectId: string }) => Promise<ProjectListReply>
  projectSelect: (request: { projectId: string }) => Promise<ProjectListReply>
  projectWorkspaceList: (request: { projectId: string }) => Promise<ProjectWorkspaceReply>
  projectWorkspaceSelect: (request: {
    projectId: string
    workspaceId: string
  }) => Promise<ProjectWorkspaceReply>
  projectWorkspaceCreateManaged: (request: {
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

export const storybookProjectProcedures: StorybookProjectProcedures = {
  projectList: () => Promise.resolve(listed('storybook-project')),
  projectOpen: () =>
    Promise.resolve({
      version: 1,
      type: 'project.opened' as const,
      requestId: 'storybook-project',
      project: { id: 'storybook-project', name: 'argo' },
    }),
  projectSetupSnapshot: ({ projectId }) => Promise.resolve(setupSnapshot(projectId)),
  projectSetupCommand: ({ projectId }) => Promise.resolve(setupSnapshot(projectId)),
  projectRegister: () => Promise.resolve(listed('storybook-worktree')),
  projectRelocate: () => Promise.resolve(listed('storybook-worktree')),
  projectSelect: ({ projectId }) => Promise.resolve(listed(projectId)),
  projectWorkspaceList: () => Promise.resolve(workspacesListed('storybook-workspace-main')),
  projectWorkspaceSelect: ({ workspaceId }) => Promise.resolve(workspacesListed(workspaceId)),
  projectWorkspaceCreateManaged: () =>
    Promise.resolve(workspacesListed('storybook-workspace-main')),
}
