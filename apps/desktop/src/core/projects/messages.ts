// The three actions #1828 adds to the version 1 Project contract, beside the `project.open` that
// #1825 settled. Version 1 gains actions and never changes a message it already defines, so a
// `project.open` exchange is byte-identical to the one the accepted proof asserts.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
import { isAction, type ProjectError } from './contract'

// A Project as the cockpit draws it: the stable ID, the folder name, and the path, which is a
// mutable attribute of the identity rather than the identity itself (CONTEXT.md · Project).
export type ProjectSummary = { id: string; name: string; path: string }

export type ProjectListRequest = { version: 1; type: 'project.list'; requestId: string }
export type ProjectRegisterRequest = { version: 1; type: 'project.register'; requestId: string }
export type ProjectRelocateRequest = {
  version: 1
  type: 'project.relocate'
  requestId: string
  projectId: string
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

export type ProjectListReply = ProjectListed | ProjectCancelled | ProjectError

export function isProjectListRequest(value: unknown): value is ProjectListRequest {
  return isAction(value, 'project.list')
}

export function isProjectRegisterRequest(value: unknown): value is ProjectRegisterRequest {
  return isAction(value, 'project.register')
}

export function isProjectRelocateRequest(value: unknown): value is ProjectRelocateRequest {
  return isAction(value, 'project.relocate', ['projectId'])
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

// A selection that names no listed Project is not a listing with a stale pointer: storage already
// dropped that on the way out (src/projects/registry.ts), so a reply carrying one is malformed.
function isSelection(selectedId: unknown, projects: ProjectSummary[]): boolean {
  if (selectedId === null) return true
  return isIdentifier(selectedId) && projects.some((project) => project.id === selectedId)
}

export function isProjectCancelled(value: unknown): value is ProjectCancelled {
  return isAction(value, 'project.cancelled')
}
