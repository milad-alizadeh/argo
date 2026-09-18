import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type ProjectTarget = {
  name: string
  path: string
  default: boolean
  setup: string
  run: string
  build: string
  test: string
}

export type ProjectConfiguration = { targets: ProjectTarget[] }

type TargetValues = Record<string, string | boolean | number>

const sharedConfiguration = (projectPath: string) =>
  path.join(projectPath, '.argo', 'settings.json')
const localConfiguration = (projectPath: string) =>
  path.join(projectPath, '.argo', 'settings.local.json')

export async function readProjectConfigurationSource(projectPath: string): Promise<string | null> {
  const shared = await readFile(sharedConfiguration(projectPath), 'utf8').catch(() => null)
  if (shared === null) return null
  const local = await readFile(localConfiguration(projectPath), 'utf8').catch(() => '')
  return `${shared}\n// Local override\n${local}`
}

export async function readProjectConfiguration(
  projectPath: string,
): Promise<ProjectConfiguration | null> {
  const shared = await readJson(sharedConfiguration(projectPath))
  if (shared?.version !== 1) return null
  const local = await readJson(localConfiguration(projectPath))
  if (local === undefined) return toConfiguration(shared.targets)
  if (!local || local.version !== undefined) return null
  return toConfiguration(mergeTargets(shared.targets, local.targets))
}

export async function saveProjectConfiguration(
  projectPath: string,
  source: string,
): Promise<boolean> {
  const parsed = parseConfiguration(source)
  if (parsed?.version !== 1) return false
  if (toConfiguration(parsed.targets) === null) return false
  const directory = path.join(projectPath, '.argo')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'settings.json'), source)
  return true
}

export function parseProjectConfiguration(source: string): ProjectConfiguration | null {
  const parsed = parseConfiguration(source)
  return parsed?.version === 1 ? toConfiguration(parsed.targets) : null
}

type ParsedConfiguration = { version: number | undefined; targets: Map<string, TargetValues> }

async function readJson(file: string): Promise<ParsedConfiguration | null | undefined> {
  const source = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) =>
    error.code === 'ENOENT' ? undefined : null,
  )
  if (source === undefined || source === null) return source
  return parseConfiguration(source)
}

function parseConfiguration(source: string): ParsedConfiguration | null {
  try {
    const parsed = JSON.parse(source)
    if (!isObject(parsed)) return null
    const targets = parsed.targets
    if (!isObject(targets)) return null
    const configured = new Map<string, TargetValues>()
    for (const [name, values] of Object.entries(targets)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name) || !isObject(values)) return null
      const target: TargetValues = {}
      for (const [key, value] of Object.entries(values)) {
        if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
          return null
        }
        target[key] = value
      }
      configured.set(name, target)
    }
    return {
      version: typeof parsed.version === 'number' ? parsed.version : undefined,
      targets: configured,
    }
  } catch {
    return null
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeTargets(
  shared: Map<string, TargetValues>,
  local: Map<string, TargetValues>,
): Map<string, TargetValues> | null {
  const merged = new Map(shared)
  for (const [name, override] of local) {
    const target = merged.get(name)
    if (!target || Object.keys(override).some((key) => key !== 'path')) return null
    merged.set(name, { ...target, ...override })
  }
  return merged
}

function toConfiguration(targets: Map<string, TargetValues> | null): ProjectConfiguration | null {
  if (!targets) return null
  const configured = [...targets].map(([name, values]) => toTarget(name, values))
  if (configured.some((target) => target === null)) return null
  const ready = configured as ProjectTarget[]
  return ready.filter((target) => target.default).length === 1 ? { targets: ready } : null
}

function toTarget(name: string, values: TargetValues): ProjectTarget | null {
  const { path: targetPath, default: isDefault, setup, run, build, test } = values
  if (
    typeof targetPath !== 'string' ||
    typeof isDefault !== 'boolean' ||
    typeof setup !== 'string' ||
    typeof run !== 'string' ||
    typeof build !== 'string' ||
    typeof test !== 'string' ||
    !targetPath ||
    !setup ||
    !run ||
    !build ||
    !test
  ) {
    return null
  }
  return { name, path: targetPath, default: isDefault, setup, run, build, test }
}
