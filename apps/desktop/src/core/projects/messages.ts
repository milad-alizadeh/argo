// Project actions extend the #1825 contract without changing a `project.open` exchange.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
import { isAction, type ProjectError } from './contract'

// A Project as the cockpit draws it: the stable ID, the folder name, and the path, which is a
// mutable attribute of the identity rather than the identity itself (CONTEXT.md · Project).
export type ProjectSummary = { id: string; name: string; path: string }

export const PROJECT_IMPORT_ACTION = 'project.import' as const
export const PENDING_IMPORT_CATEGORIES = ['Accounts'] as const

export type ProjectListRequest = { version: 1; type: 'project.list'; requestId: string }
export type ProjectRegisterRequest = { version: 1; type: 'project.register'; requestId: string }
export type ProjectRelocateRequest = {
  version: 1
  type: 'project.relocate'
  requestId: string
  projectId: string
}
export type ProjectImportRequest = {
  version: 1
  type: typeof PROJECT_IMPORT_ACTION
  requestId: string
}

// Every action that can change the known set answers with the whole set, so the renderer never
// assembles its own picture of storage out of a sequence of replies.
export type ProjectListed = {
  version: 1
  type: 'project.listed'
  requestId: string
  projects: ProjectSummary[]
  selectedId: string | null
}

// The person dismissed the folder chooser. Nothing was read and nothing was written.
export type ProjectCancelled = { version: 1; type: 'project.cancelled'; requestId: string }

export type ProjectImported = Omit<ProjectListed, 'type'> & {
  type: 'project.imported'
  importedCount: number
  pendingCategories: typeof PENDING_IMPORT_CATEGORIES
}

export type ProjectListReply = ProjectListed | ProjectCancelled | ProjectImported | ProjectError

export function isProjectListRequest(value: unknown): value is ProjectListRequest {
  return isAction(value, 'project.list')
}

export function isProjectRegisterRequest(value: unknown): value is ProjectRegisterRequest {
  return isAction(value, 'project.register')
}

export function isProjectRelocateRequest(value: unknown): value is ProjectRelocateRequest {
  return isAction(value, 'project.relocate', ['projectId'])
}

export function isProjectImportRequest(value: unknown): value is ProjectImportRequest {
  return isAction(value, PROJECT_IMPORT_ACTION)
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  return (
    isRecord(value) &&
    hasKeys(value, ['id', 'name', 'path']) &&
    isIdentifier(value.id) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.path === 'string' &&
    value.path.length > 0
  )
}

export function isProjectListed(value: unknown): value is ProjectListed {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', 'projects', 'selectedId']) &&
    value.version === 1 &&
    value.type === 'project.listed' &&
    isIdentifier(value.requestId) &&
    Array.isArray(value.projects) &&
    value.projects.every(isProjectSummary) &&
    isSelection(value.selectedId, value.projects)
  )
}

export function isProjectImported(value: unknown): value is ProjectImported {
  if (!isRecord(value)) return false
  const { importedCount, pendingCategories, ...listing } = value
  return (
    hasKeys(value, [
      'version',
      'type',
      'requestId',
      'projects',
      'selectedId',
      'importedCount',
      'pendingCategories',
    ]) &&
    value.type === 'project.imported' &&
    typeof importedCount === 'number' &&
    Number.isInteger(importedCount) &&
    importedCount >= 0 &&
    Array.isArray(pendingCategories) &&
    pendingCategories.length === 1 &&
    pendingCategories[0] === PENDING_IMPORT_CATEGORIES[0] &&
    isProjectListed({ ...listing, type: 'project.listed' })
  )
}

// A selection that names no listed Project is not a listing with a stale pointer: storage already
// dropped that on the way out (src/projects/registry.ts), so a reply carrying one is malformed.
function isSelection(selectedId: unknown, projects: ProjectSummary[]): boolean {
  if (selectedId === null) return true
  return isIdentifier(selectedId) && projects.some((project) => project.id === selectedId)
}

export function isProjectCancelled(value: unknown): value is ProjectCancelled {
  return isAction(value, 'project.cancelled')
}
