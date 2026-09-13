import { posix } from 'node:path'

// Every path is relative to the Storybook root, as `storybook build` writes it, without the `./`.
export type Story = { id: string; name: string; title: string; importPath: string }

// Each module mapped to the modules that import it. A module only ever seen as an importer, such as
// `.storybook/preview.ts`, still gets a key.
export type Importers = Map<string, string[]>

export type StorybookBuild = { stories: Story[]; importers: Importers }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStory(entry: Record<string, unknown>): entry is Record<string, unknown> & Story {
  return ['id', 'name', 'title', 'importPath'].every((key) => typeof entry[key] === 'string')
}

function parseJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${source}: invalid JSON (${reason})`)
  }
}

// A docs entry shares the manifest with the stories and is dropped here, so nothing links it.
export function parseStories(text: string, source: string): Story[] {
  const value = parseJson(text, source)
  if (!isRecord(value) || !isRecord(value.entries)) {
    throw new Error(`${source}: expected an object with an entries object`)
  }
  const stories: Story[] = []
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isRecord(entry) || typeof entry.type !== 'string') {
      throw new Error(`${source}: entry ${key} must have an object value with a type`)
    }
    if (entry.type !== 'story') continue
    if (!isStory(entry)) {
      throw new Error(`${source}: story entry ${key} is missing id, name, title, or importPath`)
    }
    const { id, name, title, importPath } = entry
    stories.push({ id, name, title, importPath: posix.normalize(importPath) })
  }
  return stories
}

function parseModule(node: unknown, source: string): { id: string; importers: string[] } {
  const reasons = isRecord(node) ? (node.reasons ?? []) : null
  if (!isRecord(node) || typeof node.id !== 'string' || !Array.isArray(reasons)) {
    throw new Error(`${source}: every module must have a string id and a reasons array`)
  }
  const names = reasons.map((reason) => (isRecord(reason) ? reason.moduleName : null))
  if (!names.every((name): name is string => typeof name === 'string')) {
    throw new Error(`${source}: module ${node.id} has a reason without a moduleName`)
  }
  return { id: posix.normalize(node.id), importers: names.map((name) => posix.normalize(name)) }
}

export function parseImporters(text: string, source: string): Importers {
  const value = parseJson(text, source)
  if (!isRecord(value) || !Array.isArray(value.modules)) {
    throw new Error(`${source}: expected an object with a modules array`)
  }
  const importers: Importers = new Map()
  for (const node of value.modules) {
    const { id, importers: names } = parseModule(node, source)
    for (const name of [id, ...names]) {
      if (!importers.has(name)) importers.set(name, [])
    }
    importers.get(id)?.push(...names)
  }
  return importers
}
