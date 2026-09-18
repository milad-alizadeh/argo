import path from 'node:path'
import type { ProjectListed, ProjectSummary } from './messages'
import type { ProjectRegistration, ProjectRegistry } from './sqlite-store'

export function toSummary(registration: Pick<ProjectRegistration, 'id' | 'path'>): ProjectSummary {
  return {
    id: registration.id,
    name: path.basename(registration.path) || registration.path,
    path: registration.path,
  }
}

export function listed(requestId: string, registry: ProjectRegistry): ProjectListed {
  return {
    version: 1,
    type: 'project.listed',
    requestId,
    projects: registry.projects.map(toSummary),
    selectedId: registry.selectedId,
  }
}
