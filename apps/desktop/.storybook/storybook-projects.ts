import type { RouterOutputs } from '../src/platform/renderer/trpc-client'

type ProjectListReply = RouterOutputs['projectList']
type ProjectOpenReply = RouterOutputs['projectOpen']
type ProjectRelocateReply = RouterOutputs['projectRelocate']
type WorktreeOptionsReply = RouterOutputs['worktreeOptions']
type WorktreeSwitchReply = RouterOutputs['worktreeSwitch']

type StorybookProjectProcedures = {
  projectOpen: (request: { projectId: string }) => Promise<ProjectOpenReply>
  projectList: () => Promise<ProjectListReply>
  projectRegister: () => Promise<ProjectListReply>
  projectRelocate: (request: { projectId: string }) => Promise<ProjectRelocateReply>
  worktreeOptions: (request: { projectId: string }) => Promise<WorktreeOptionsReply>
  worktreeSwitch: (request: {
    projectId: string
    newWorktree: boolean
  }) => Promise<WorktreeSwitchReply>
}

const primaryProject = { id: 'storybook-project', name: 'argo', path: '/storybook/argo' }
const secondaryProject = {
  id: 'storybook-worktree',
  name: 'worktree',
  path: '/storybook/worktree',
}
const projects = [primaryProject, secondaryProject]

function worktreeOptions() {
  return {
    type: 'worktree.options' as const,
    requestId: 'storybook-worktrees',
    newWorktree: false,
    checkout: { path: primaryProject.path, branch: 'main' },
    branches: ['main'],
  }
}

export const storybookProjectProcedures: StorybookProjectProcedures = {
  projectList: () => Promise.resolve(projects),
  projectOpen: () => Promise.resolve(primaryProject),
  projectRegister: () => Promise.resolve(projects),
  projectRelocate: () => Promise.resolve(secondaryProject),
  worktreeOptions: () => Promise.resolve(worktreeOptions()),
  worktreeSwitch: ({ newWorktree }) => Promise.resolve({ newWorktree }),
}
