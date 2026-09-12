// The one-way Project import reads Swift data at the external boundary before the portable registry is written.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isIdentifier, isRecord } from '../../boundary'
import { projectError } from './contract'
import {
  isProjectImportRequest,
  PENDING_IMPORT_CATEGORIES,
  type ProjectImported,
  type ProjectListReply,
} from './messages'
import { openRegistry } from './register-project'
import { listed, type Registration, type Registry, readRegistry, writeRegistry } from './registry'

type ImportedBinding = { port: 'ticket' | 'codeHost'; accountID: string; scope: string }
type ImportedRegistration = Registration & { bindings?: ImportedBinding[] }
type SourceRegistry = { projects: ImportedRegistration[]; activeProjectId: string | null }

export type ProjectImportStore = { registryPath: string; sourceRegistryPath: string }

function sourceError(error: unknown): 'import-source-missing' | 'import-source-unavailable' {
  return isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ? 'import-source-missing'
    : 'import-source-unavailable'
}

function importBinding(value: unknown): ImportedBinding {
  if (!isRecord(value) || typeof value.accountID !== 'string' || typeof value.scope !== 'string') {
    throw new Error('Invalid Binding')
  }
  const port = value.port === 'workItem' ? 'ticket' : value.port
  if ((port !== 'ticket' && port !== 'codeHost') || !value.accountID || !value.scope) {
    throw new Error('Invalid Binding')
  }
  return { port, accountID: value.accountID, scope: value.scope }
}

function importRegistration(value: unknown): ImportedRegistration {
  if (
    !isRecord(value) ||
    !isIdentifier(value.id) ||
    typeof value.path !== 'string' ||
    !path.isAbsolute(value.path) ||
    value.path.includes('\0')
  ) {
    throw new Error('Invalid Project')
  }
  const bindings = value.bindings === undefined ? undefined : asBindings(value.bindings)
  return bindings === undefined
    ? { id: value.id, path: value.path }
    : { id: value.id, path: value.path, bindings }
}

function asBindings(value: unknown): ImportedBinding[] {
  if (!Array.isArray(value)) throw new Error('Invalid Bindings')
  const bindings = value.map(importBinding)
  if (new Set(bindings.map((binding) => binding.port)).size !== bindings.length) {
    throw new Error('Repeated Binding port')
  }
  return bindings
}

function parseSource(value: unknown): SourceRegistry {
  if (!isRecord(value) || !Array.isArray(value.projects))
    throw new Error('Invalid Project registry')
  const projects = value.projects.map(importRegistration)
  if (
    new Set(projects.map((project) => project.id)).size !== projects.length ||
    new Set(projects.map((project) => project.path)).size !== projects.length
  ) {
    throw new Error('Repeated Project')
  }
  const activeProjectId = value.activeProjectId
  if (
    activeProjectId !== undefined &&
    activeProjectId !== null &&
    (typeof activeProjectId !== 'string' ||
      !projects.some((project) => project.id === activeProjectId))
  ) {
    throw new Error('Invalid active Project')
  }
  return { projects, activeProjectId: activeProjectId ?? null }
}

async function readSource(sourceRegistryPath: string): Promise<SourceRegistry | ProjectListReply> {
  let content: string
  try {
    content = await readFile(sourceRegistryPath, 'utf8')
  } catch (error) {
    return projectError(sourceError(error), null)
  }
  try {
    return parseSource(JSON.parse(content))
  } catch {
    return projectError('import-needs-attention', null)
  }
}

function bindings(registration: Registration): unknown[] {
  return Array.isArray(registration.bindings) ? registration.bindings : []
}

function sameProject(destination: Registration, source: ImportedRegistration): boolean {
  return (
    destination.id === source.id &&
    destination.path === source.path &&
    JSON.stringify(bindings(destination)) === JSON.stringify(bindings(source))
  )
}

function merge(destination: Registry, source: SourceRegistry): Registry | null {
  for (const imported of source.projects) {
    const knownById = destination.projects.find((project) => project.id === imported.id)
    const knownByPath = destination.projects.find((project) => project.path === imported.path)
    if (
      (knownById && !sameProject(knownById, imported)) ||
      (knownByPath && knownByPath.id !== imported.id)
    ) {
      return null
    }
  }
  const projects = [...destination.projects]
  for (const imported of source.projects) {
    if (!projects.some((project) => project.id === imported.id)) projects.push(imported)
  }
  return {
    ...destination,
    projects,
    selectedId: source.activeProjectId ?? destination.selectedId,
  }
}

export async function importProjects(
  value: unknown,
  store: ProjectImportStore,
): Promise<ProjectListReply> {
  if (!isProjectImportRequest(value)) return projectError('invalid-request', null)
  const source = await readSource(store.sourceRegistryPath)
  if ('type' in source) return { ...source, requestId: value.requestId }
  const opened = openRegistry(await readRegistry(store.registryPath))
  if (typeof opened === 'string') return projectError(opened, value.requestId)
  const registry = merge(opened, source)
  if (!registry) return projectError('import-needs-attention', value.requestId)
  if (!(await writeRegistry(store.registryPath, registry))) {
    return projectError('storage-not-written', value.requestId)
  }
  const imported: ProjectImported = {
    ...listed(value.requestId, registry),
    type: 'project.imported',
    importedCount: source.projects.filter(
      (project) => !opened.projects.some((destination) => destination.id === project.id),
    ).length,
    pendingCategories: PENDING_IMPORT_CATEGORIES,
  }
  return imported
}
