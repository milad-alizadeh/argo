import { realpath } from 'node:fs/promises'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { createManagedWorkspace } from '@/domains/projects/main/workspaces/create-managed-workspace'
import { reconcileWorkspaces } from '@/domains/projects/main/workspaces/workspace-reconciliation'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'

function selectedProject(store: ProjectStore) {
  const registry = store.read()
  const project = registry.projects.find((candidate) => candidate.id === registry.selectedId)
  if (project === undefined) throw new Error('No Project is selected')
  return project
}

export async function resolveSessionWorkspace(
  selection: WorkspaceSelection,
  store: ProjectStore,
): Promise<{ workspaceId: string; cwd: string }> {
  const project = selectedProject(store)
  const workspaces = await reconcileWorkspaces(store, project)
  switch (selection.kind) {
    case 'main': {
      const workspace = workspaces.find((candidate) => candidate.kind === 'main')
      if (workspace === undefined) throw new Error('The main Workspace is unavailable')
      return { workspaceId: workspace.id, cwd: workspace.path }
    }
    case 'existing': {
      const workspace = workspaces.find((candidate) => candidate.id === selection.workspaceId)
      if (workspace === undefined) throw new Error('The selected Workspace is unavailable')
      return { workspaceId: workspace.id, cwd: workspace.path }
    }
    case 'new': {
      const workspace = await createManagedWorkspace(store, project, selection.baseRef)
      return { workspaceId: workspace.id, cwd: workspace.path }
    }
  }
}

export async function workspaceSelectionForSessionCwd(
  cwd: string,
  store: ProjectStore,
): Promise<WorkspaceSelection> {
  const project = selectedProject(store)
  const workspaces = await reconcileWorkspaces(store, project)
  const resolvedCwd = await realpath(cwd).catch(() => cwd)
  const resolvedWorkspaces = await Promise.all(
    workspaces.map(async (candidate) => ({
      candidate,
      path: await realpath(candidate.path).catch(() => candidate.path),
    })),
  )
  const workspace = resolvedWorkspaces.find(
    (candidate) => candidate.path === resolvedCwd,
  )?.candidate
  if (workspace === undefined) {
    const resolvedProject = await realpath(project.path).catch(() => project.path)
    if (resolvedProject === resolvedCwd) return { kind: 'main' }
    throw new Error('The selected Workspace is unavailable')
  }
  return workspace.kind === 'main'
    ? { kind: 'main' }
    : { kind: 'existing', workspaceId: workspace.id }
}
