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
  path.join(projectPath, '.argo', 'settings.toml')
const localConfiguration = (projectPath: string) =>
  path.join(projectPath, '.argo', 'settings.local.toml')

export async function readProjectConfigurationSource(projectPath: string): Promise<string | null> {
  return readFile(sharedConfiguration(projectPath), 'utf8').catch(() => null)
}

export async function readProjectConfiguration(
  projectPath: string,
): Promise<ProjectConfiguration | null> {
  const shared = await readToml(sharedConfiguration(projectPath))
  if (shared?.version !== 1) return null
  const local = await readToml(localConfiguration(projectPath))
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
  await writeFile(path.join(directory, 'settings.toml'), source)
  return true
}

type ParsedConfiguration = { version: number | undefined; targets: Map<string, TargetValues> }

async function readToml(file: string): Promise<ParsedConfiguration | null | undefined> {
  const source = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) =>
    error.code === 'ENOENT' ? undefined : null,
  )
  if (source === undefined || source === null) return source
  return parseConfiguration(source)
}

function parseConfiguration(source: string): ParsedConfiguration | null {
  const result: ParsedConfiguration = { version: undefined, targets: new Map() }
  let target: TargetValues | undefined
  for (const rawLine of source.split('\n')) {
    const line = rawLine.replace(/\s*#.*/, '').trim()
    if (!line) continue
    const name = targetName(line)
    if (name) {
      target = result.targets.get(name) ?? {}
      result.targets.set(name, target)
      continue
    }
    if (!addAssignment(result, target, line)) return null
  }
  return result
}

function targetName(line: string): string | null {
  return /^\[targets\.([A-Za-z][A-Za-z0-9_-]*)\]$/.exec(line)?.[1] ?? null
}

function addAssignment(
  configuration: ParsedConfiguration,
  target: TargetValues | undefined,
  line: string,
): boolean {
  const assignment = /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/.exec(line)
  const key = assignment?.[1]
  const value = assignment?.[2] && primitive(assignment[2])
  if (!key || value === null || value === undefined) return false
  if (target) target[key] = value
  else if (key === 'version' && typeof value === 'number') configuration.version = value
  return true
}

function primitive(source: string): string | boolean | number | null {
  if (source === 'true') return true
  if (source === 'false') return false
  if (/^\d+$/.test(source)) return Number(source)
  const string = /^"([^"\\]*(?:\\.[^"\\]*)*)"$/.exec(source)
  const value = string?.[1]
  return value === undefined ? null : value.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
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
