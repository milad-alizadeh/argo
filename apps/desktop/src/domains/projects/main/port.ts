// The Project facts other domains may use. Project storage remains private to this domain.
import { toSummary } from '@/domains/projects/main/presentation'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'

export type ProjectPort = {
  has: (projectId: string) => boolean
  names: () => Map<string, string>
}

export function createProjectPort(store: ProjectStore): ProjectPort {
  return {
    has: (projectId) => store.read().projects.some((project) => project.id === projectId),
    names: () =>
      new Map(store.read().projects.map((project) => [project.id, toSummary(project).name])),
  }
}
