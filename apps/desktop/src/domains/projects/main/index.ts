// The Project facts other domains may use. Project storage remains private to this domain.
import { realpath } from 'node:fs/promises'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import { toSummary } from './presentation'
import { resolveSessionWorkspace } from './resolve-session-workspace'
import type { ProjectStore } from './sqlite-store'

export type ProjectPort = {
  has: (projectId: string) => boolean
  names: () => Map<string, string>
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
  projectForWorkspace: (workspaceId: string) => string | null
  selectedProjectId: () => string | null
}

export function createProjectPort(store: ProjectStore): ProjectPort {
  return {
    selectedProjectId: () => store.read().selectedId,
    has: (projectId) => store.read().projects.some((project) => project.id === projectId),
    projectForWorkspace: (workspaceId) =>
      store
        .read()
        .projects.find((project) =>
          store.readWorkspaces(project.id).some((workspace) => workspace.id === workspaceId),
        )?.id ?? null,
    names: () =>
      new Map(store.read().projects.map((project) => [project.id, toSummary(project).name])),
    resolveWorkspace: (selection) => resolveSessionWorkspace(selection, store),
    knownWorkspaces: async () => {
      const workspaces = store
        .read()
        .projects.flatMap((project) => store.readWorkspaces(project.id))
      const paths = await Promise.all(
        workspaces.map(async (workspace) => ({
          id: workspace.id,
          stored: workspace.path,
          resolved: await realpath(workspace.path).catch(() => workspace.path),
        })),
      )
      return paths.flatMap((workspace) => [
        { id: workspace.id, path: workspace.stored },
        ...(workspace.resolved === workspace.stored
          ? []
          : [{ id: workspace.id, path: workspace.resolved }]),
      ])
    },
  }
}
