import type { RouterOutputs } from '../src/platform/renderer/trpc-client'

type ProjectListReply = RouterOutputs['projectList']
type ProjectOpenReply = RouterOutputs['projectOpen']
type ProjectRelocateReply = RouterOutputs['projectRelocate']
type WorkspaceReply = RouterOutputs['workspaceList']

type StorybookProjectProcedures = {
  projectOpen: (request: { projectId: string }) => Promise<ProjectOpenReply>
  projectList: () => Promise<ProjectListReply>
  projectRegister: () => Promise<ProjectListReply>
  projectRelocate: (request: { projectId: string }) => Promise<ProjectRelocateReply>
  workspaceList: (request: { projectId: string }) => Promise<WorkspaceReply>
}

const primaryProject = { id: 'storybook-project', name: 'argo', path: '/storybook/argo' }
const secondaryProject = {
  id: 'storybook-worktree',
  name: 'worktree',
  path: '/storybook/worktree',
}
const projects = [primaryProject, secondaryProject]

const workspaces = [
  {
    id: 'storybook-workspace-main',
    kind: 'main' as const,
    displayName: 'Main checkout',
    path: '/storybook/argo',
    facts: { branch: 'main', headSha: 'storybook-sha', dirty: false },
  },
]

function workspacesListed() {
  return {
    type: 'workspace.listed' as const,
    requestId: 'storybook-workspaces',
    workspaces,
  }
}

export const storybookProjectProcedures: StorybookProjectProcedures = {
  projectList: () => Promise.resolve(projects),
  projectOpen: () => Promise.resolve(primaryProject),
  projectRegister: () => Promise.resolve(projects),
  projectRelocate: () => Promise.resolve(secondaryProject),
  workspaceList: () => Promise.resolve(workspacesListed()),
}
