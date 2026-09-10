// The per-machine file registry: the known set of Projects and which one the cockpit has open.
// Owned state, so it lives in `userData` and is never committed (ADR-0017, ADR-0008).
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isIdentifier, isRecord } from '../../boundary'
import type { ProjectListed, ProjectSummary } from './messages'

// A registration is `{id, path}` and whatever else the file already held. Another portable client
// may own fields this workflow never reads, and a write must not delete them
// (docs/portable-integration-contracts.md).
export type Registration = { id: string; path: string; [key: string]: unknown }
export type Registry = {
  projects: Registration[]
  selectedId: string | null
  other: Record<string, unknown>
}

export type RegistryRead =
  | { ok: true; registry: Registry }
  // `missing` is a fresh installation and `unreadable` is a real storage failure. A caller that
  // has to tell an empty cockpit from a broken one needs both, so they are not one reason.
  | { ok: false; reason: 'missing' | 'unreadable' | 'invalid' }

export const EMPTY_REGISTRY: Registry = { projects: [], selectedId: null, other: {} }

function parseRegistrations(value: unknown): Registration[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.projects)) {
    throw new Error('Invalid Project registry')
  }
  const identifiers = new Set<string>()
  return value.projects.map((project: unknown) => {
    if (
      !isRecord(project) ||
      !isIdentifier(project.id) ||
      identifiers.has(project.id) ||
      typeof project.path !== 'string' ||
      !path.isAbsolute(project.path) ||
      project.path.includes('\0')
    ) {
      throw new Error('Invalid Project registry')
    }
    identifiers.add(project.id)
    return { ...project, id: project.id, path: project.path }
  })
}

const OWNED = ['version', 'projects', 'selectedId']

function parseRegistry(value: unknown): Registry {
  const projects = parseRegistrations(value)
  const document = isRecord(value) ? value : {}
  const stored = document.selectedId
  // A selection naming a Project that is no longer registered is a stale pointer, not corruption.
  const selectedId =
    isIdentifier(stored) && projects.some((project) => project.id === stored) ? stored : null
  const other = Object.fromEntries(Object.entries(document).filter(([key]) => !OWNED.includes(key)))
  return { projects, selectedId, other }
}

export async function readRegistry(registryPath: string): Promise<RegistryRead> {
  let content: string
  try {
    content = await readFile(registryPath, 'utf8')
  } catch (error) {
    const missing = isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    return { ok: false, reason: missing ? 'missing' : 'unreadable' }
  }
  try {
    return { ok: true, registry: parseRegistry(JSON.parse(content)) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

// Replace the file through a rename, so an interrupted write leaves the previous registry intact
// rather than a truncated one.
export async function writeRegistry(registryPath: string, registry: Registry): Promise<boolean> {
  const pending = `${registryPath}.${randomUUID()}.pending`
  try {
    await mkdir(path.dirname(registryPath), { recursive: true })
    const { projects, selectedId, other } = registry
    const document = { ...other, version: 1, projects, selectedId }
    await writeFile(pending, `${JSON.stringify(document, null, 2)}\n`)
    await rename(pending, registryPath)
    return true
  } catch {
    return false
  }
}

export function newProjectId(): string {
  return `project-${randomUUID()}`
}

export function toSummary(registration: Registration): ProjectSummary {
  return {
    id: registration.id,
    name: path.basename(registration.path) || registration.path,
    path: registration.path,
  }
}

export function listed(requestId: string, registry: Registry): ProjectListed {
  return {
    version: 1,
    type: 'project.listed',
    requestId,
    projects: registry.projects.map(toSummary),
    selectedId: registry.selectedId,
  }
}
