import type { RouterOutputs } from '../src/platform/renderer/trpc-client'

type ProjectListReply = RouterOutputs['projectList']
type ProjectOpenReply = RouterOutputs['projectOpen']
type ProjectRelocateReply = RouterOutputs['projectRelocate']
type WorktreeReply = RouterOutputs['worktreeList']
type WorktreeChooseReply = RouterOutputs['worktreeChoose']

type StorybookProjectProcedures = {
  projectOpen: (request: { projectId: string }) => Promise<ProjectOpenReply>
  projectList: () => Promise<ProjectListReply>
  projectRegister: () => Promise<ProjectListReply>
  projectRelocate: (request: { projectId: string }) => Promise<ProjectRelocateReply>
  worktreeList: (request: { projectId: string }) => Promise<WorktreeReply>
  worktreeChoose: (request: { projectId: string; choice: string }) => Promise<WorktreeChooseReply>
}

const primaryProject = { id: 'storybook-project', name: 'argo', path: '/storybook/argo' }
const secondaryProject = {
  id: 'storybook-worktree',
  name: 'worktree',
  path: '/storybook/worktree',
}
const projects = [primaryProject, secondaryProject]

const worktrees = [{ path: '/storybook/argo', main: true, name: 'argo', branch: 'main' }]

function worktreesListed() {
  return {
    type: 'worktree.listed' as const,
    requestId: 'storybook-worktrees',
    choice: 'new',
    worktrees,
  }
}

export const storybookProjectProcedures: StorybookProjectProcedures = {
  projectList: () => Promise.resolve(projects),
  projectOpen: () => Promise.resolve(primaryProject),
  projectRegister: () => Promise.resolve(projects),
  projectRelocate: () => Promise.resolve(secondaryProject),
  worktreeList: () => Promise.resolve(worktreesListed()),
  worktreeChoose: ({ choice }) => Promise.resolve({ choice }),
}
