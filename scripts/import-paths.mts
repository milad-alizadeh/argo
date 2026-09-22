// What the import codemods in this folder all need: where source lives, how a specifier maps to a
// path, and how a path maps back to a specifier. Extracted so the three of them state it once.
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export const SOURCE_ROOT = 'apps/desktop/src'
export const ROOTS = [SOURCE_ROOT, 'apps/desktop/mocks', 'apps/desktop/e2e']

const EXTENSIONS = ['.ts', '.tsx']

export function walk(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules') continue
    const full = path.join(directory, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (/\.(ts|tsx|mts)$/.test(entry)) found.push(full)
  }
  return found
}

export function specifierPathFor(from: string, specifier: string): string {
  if (specifier.startsWith('@/')) return path.join(SOURCE_ROOT, specifier.slice(2))
  return path.join(path.dirname(from), specifier)
}

export function withoutExtension(value: string): string {
  return value.replace(/\.(ts|tsx|mts)$/, '').replace(/\/index$/, '')
}

// The file a specifier path resolves to, whether it names the file or the folder holding its
// entry point.
export function moduleFile(specifierPath: string): string | undefined {
  for (const extension of EXTENSIONS) {
    if (existsSync(specifierPath + extension)) return specifierPath + extension
  }
  for (const extension of EXTENSIONS) {
    const entry = path.join(specifierPath, `index${extension}`)
    if (existsSync(entry)) return entry
  }
  return undefined
}

export function isEntryPoint(file: string): boolean {
  return /\/index\.tsx?$/.test(file)
}

export function aliasFor(file: string): string {
  return `@/${path.relative(SOURCE_ROOT, withoutExtension(file))}`
}
