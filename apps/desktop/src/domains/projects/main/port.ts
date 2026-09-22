// The Project facts other domains may use. Project storage remains private to this domain.
import { toSummary } from '@/domains/projects/main/presentation'
import { resolveSessionWorkspace } from '@/domains/projects/main/resolve-session-workspace'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'

export type ProjectPort = {
  has: (projectId: string) => boolean
  names: () => Map<string, string>
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
}

export function createProjectPort(store: ProjectStore): ProjectPort {
  return {
    has: (projectId) => store.read().projects.some((project) => project.id === projectId),
    names: () =>
      new Map(store.read().projects.map((project) => [project.id, toSummary(project).name])),
    resolveWorkspace: (selection) => resolveSessionWorkspace(selection, store),
  }
}
